// Source-review fixture only.
import Foundation
func noteURL(base: URL, id: String) -> URL {
    base.appendingPathComponent("notes").appendingPathComponent(id)
}
