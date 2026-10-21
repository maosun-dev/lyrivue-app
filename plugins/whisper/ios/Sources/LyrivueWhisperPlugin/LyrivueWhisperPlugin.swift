import Foundation
import Capacitor
import whisper

/// 歌を whisper.cpp（iPhone 本体）で聞き取る。画面（js/app-native.js の window.lyrivueWhisper）から使う。
/// ウェブの AI（transformers.js）は iPhone 12 mini では記憶が足りず、歌を聞いて 20 秒ほどで落ちた（2026-10-21）。
/// - prepare：AI のデータ（ggml-base-q5_1.bin・57MB）が無ければ Hugging Face から読んでアプリの中に保存し、AI を読む
/// - transcribe：15 秒ほどの切れ（16kHz・1ch の Float32 を base64 で）→ 言葉ごとの時刻（秒・切れの頭から）
/// - release：AI を手放す（データは残す）
@objc(LyrivueWhisperPlugin)
public class LyrivueWhisperPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LyrivueWhisperPlugin"
    public let jsName = "LyrivueWhisper"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcribe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise)
    ]

    private static let modelName = "ggml-base-q5_1.bin"
    private static let modelURL = URL(string: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin")!
    private static let modelBytes: Int64 = 59_707_625

    /// whisper の作業は 1 本の列で順に行う（聞いている途中に手放さないため）
    private let queue = DispatchQueue(label: "com.maosundev.lyrivue.whisper")
    private var ctx: OpaquePointer?

    @objc func prepare(_ call: CAPPluginCall) {
        queue.async {
            if self.ctx != nil { call.resolve(); return }
            do {
                let path = try self.ensureModel()
                var cparams = whisper_context_default_params()
                cparams.use_gpu = true
                cparams.flash_attn = false // パソコンで試した設定（-nfa）にそろえる
                guard let c = whisper_init_from_file_with_params(path.path, cparams) else {
                    // 壊れたデータかもしれないので消しておく（次は読み直す）
                    try? FileManager.default.removeItem(at: path)
                    call.reject("AI のデータを読めませんでした")
                    return
                }
                self.ctx = c
                call.resolve()
            } catch {
                call.reject("AI のデータを用意できませんでした（\(error.localizedDescription)）")
            }
        }
    }

    @objc func transcribe(_ call: CAPPluginCall) {
        guard let audio = call.getString("audio"), let data = Data(base64Encoded: audio) else {
            call.reject("音を受け取れませんでした")
            return
        }
        let language = call.getString("language") == "en" ? "en" : "ja"
        queue.async {
            guard let c = self.ctx else { call.reject("AI がまだ読まれていません"); return }
            var samples = [Float](repeating: 0, count: data.count / MemoryLayout<Float>.size)
            _ = samples.withUnsafeMutableBytes { data.copyBytes(to: $0) }

            var params = whisper_full_default_params(WHISPER_SAMPLING_BEAM_SEARCH)
            params.beam_search.beam_size = 5
            params.greedy.best_of = 5
            params.token_timestamps = true
            params.no_context = true // 切れごとに前の切れの言葉を引きずらない
            params.n_threads = Int32(max(1, min(4, ProcessInfo.processInfo.activeProcessorCount)))
            params.print_progress = false
            params.print_realtime = false
            params.print_timestamps = false
            params.print_special = false

            let ok: Bool = language.withCString { lang in
                params.language = lang
                return samples.withUnsafeBufferPointer { buf in
                    whisper_full(c, params, buf.baseAddress, Int32(buf.count)) == 0
                }
            }
            guard ok else { call.reject("歌を聞き取れませんでした"); return }
            call.resolve(["tokens": self.collectTokens(c)])
        }
    }

    @objc func release(_ call: CAPPluginCall) {
        queue.async {
            if let c = self.ctx { whisper_free(c) }
            self.ctx = nil
            call.resolve()
        }
    }

    /// 言葉（token）ごとの時刻。日本語は 1 文字が token の途中で切れることがあるので、読める文字になるまでつなぐ
    private func collectTokens(_ c: OpaquePointer) -> [[String: Any]] {
        var out: [[String: Any]] = []
        let eot = whisper_token_eot(c) // これ以上の番号は時刻や合図の特別な token
        var pending: [UInt8] = []
        var pendingStart: Int64 = 0
        for i in 0..<whisper_full_n_segments(c) {
            for j in 0..<whisper_full_n_tokens(c, i) {
                let d = whisper_full_get_token_data(c, i, j)
                if d.id >= eot { continue }
                guard let p = whisper_full_get_token_text(c, i, j) else { continue }
                let bytes = Array(UnsafeBufferPointer(start: UnsafeRawPointer(p).assumingMemoryBound(to: UInt8.self), count: strlen(p)))
                if pending.isEmpty { pendingStart = d.t0 }
                pending += bytes
                if let text = String(data: Data(pending), encoding: .utf8) {
                    // t0・t1 は 10 ミリ秒単位
                    out.append(["text": text, "start": Double(pendingStart) / 100, "end": Double(d.t1) / 100])
                    pending.removeAll()
                } else if pending.count > 16 {
                    pending.removeAll() // 読めないまま長くなったものは捨てる
                }
            }
        }
        return out
    }

    /// AI のデータの置き場所（Application Support/whisper/）。無ければ読み込む（進み具合は progress で知らせる）
    private func ensureModel() throws -> URL {
        let fm = FileManager.default
        var dir = try fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("whisper", isDirectory: true)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        // 読み直せるデータなので、iCloud のバックアップには入れない
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? dir.setResourceValues(values)
        let file = dir.appendingPathComponent(LyrivueWhisperPlugin.modelName)
        if let size = (try? fm.attributesOfItem(atPath: file.path))?[.size] as? Int64, size == LyrivueWhisperPlugin.modelBytes { return file }
        try? fm.removeItem(at: file)

        let downloader = ModelDownloader { [weak self] loaded, total in
            self?.notifyListeners("progress", data: ["loaded": loaded, "total": total > 0 ? total : LyrivueWhisperPlugin.modelBytes])
        }
        let tmp = try downloader.download(LyrivueWhisperPlugin.modelURL)
        let size = (try? fm.attributesOfItem(atPath: tmp.path))?[.size] as? Int64 ?? 0
        guard size == LyrivueWhisperPlugin.modelBytes else {
            try? fm.removeItem(at: tmp)
            throw NSError(domain: "LyrivueWhisper", code: 1, userInfo: [NSLocalizedDescriptionKey: "大きさが違います（\(size) バイト）"])
        }
        try fm.moveItem(at: tmp, to: file)
        return file
    }
}

/// AI のデータを読み込む（終わるまで待つ。whisper の列の中から呼ぶので、画面は止まらない）
private final class ModelDownloader: NSObject, URLSessionDownloadDelegate {
    private let onProgress: (Int64, Int64) -> Void
    private let done = DispatchSemaphore(value: 0)
    private var result: Result<URL, Error> = .failure(URLError(.unknown))

    init(onProgress: @escaping (Int64, Int64) -> Void) { self.onProgress = onProgress }

    func download(_ url: URL) throws -> URL {
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        session.downloadTask(with: url).resume()
        done.wait()
        session.finishTasksAndInvalidate()
        return try result.get()
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
                    totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        onProgress(totalBytesWritten, totalBytesExpectedToWrite)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        // ここを抜けると一時ファイルは消されるので、すぐ別の名前に移す
        let keep = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".bin")
        do {
            if let http = downloadTask.response as? HTTPURLResponse, http.statusCode != 200 {
                throw NSError(domain: "LyrivueWhisper", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: "サーバーの返事が \(http.statusCode)"])
            }
            try FileManager.default.moveItem(at: location, to: keep)
            result = .success(keep)
        } catch {
            result = .failure(error)
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error { result = .failure(error) }
        done.signal()
    }
}
