// swift-tools-version: 5.9
import PackageDescription

// Lyrivue の自作プラグイン：歌を whisper.cpp（公式の iPhone 用部品 v1.9.2）で聞き取る
let package = Package(
    name: "LyrivueWhisper",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "LyrivueWhisper",
            targets: ["LyrivueWhisperPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        // 部品の中は動的ライブラリ（Metal・Accelerate を使う）。対応は iOS 16.4 から（アプリの対応もそろえた）
        .binaryTarget(
            name: "whisper",
            url: "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-v1.9.2-xcframework.zip",
            checksum: "af74fed13ea7f2d5ca2a39d9f58ec177713fafd7cab63aef4e27b79f3ceca80b"),
        .target(
            name: "LyrivueWhisperPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                "whisper"
            ],
            path: "ios/Sources/LyrivueWhisperPlugin")
    ]
)
