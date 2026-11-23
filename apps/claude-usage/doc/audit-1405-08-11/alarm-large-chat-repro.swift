import Foundation
let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
func check(_ big: Bool) throws -> Int {
    let sub = root.appendingPathComponent(big ? "large" : "small")
    let folder = sub.appendingPathComponent("project")
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let file = folder.appendingPathComponent("chat.jsonl")
    let now = Date()
    let iso = ISO8601DateFormatter()
    func answer(_ id: String) throws -> Data {
        let o: [String: Any] = ["type":"assistant", "uuid":id,"timestamp":iso.string(from: now),"message":["model":"claude-sonnet","stop_reason":"end_turn","usage":["input_tokens":100,"output_tokens":10]]]
        return try JSONSerialization.data(withJSONObject:o) + Data([10])
    }
    var data = Data("{\"type\":\"custom-title\",\"customTitle\":\"پیام رسان (خودکار)\"}\n".utf8)
    if big { data.append(Data(String(repeating: "{\"type\":\"progress\"}\n", count:220000).utf8)) }
    data.append(try answer("one"));try data.write(to:file)
    let alarms = Alarms(root:sub);var count=0
    alarms.sink = { _,_ in count += 1 }
    alarms.tick(now:now)
    let h=try FileHandle(forWritingTo:file);try h.seekToEnd();try h.write(contentsOf:answer("two"));try h.close()
    alarms.tick(now:now.addingTimeInterval(2))
    print(big ? "large" : "small", "automatic chat notifications:",count)
    return count
}
let small=try check(false),large=try check(true)
print("expected 0 in both;", small == 0 && large == 0 ? "PASS" : "FAIL")
exit(small == 0 && large == 0 ? 0 : 1)
