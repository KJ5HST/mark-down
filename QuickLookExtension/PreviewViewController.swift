import Cocoa
import QuickLookUI
import UniformTypeIdentifiers

class PreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let markdown = try String(contentsOf: request.fileURL, encoding: .utf8)
        let html = MarkdownToHTML.convert(markdown)

        let reply = QLPreviewReply(dataOfContentType: .html, contentSize: .zero) { replyToUpdate in
            replyToUpdate.stringEncoding = .utf8
            return html.data(using: .utf8)!
        }
        return reply
    }
}
