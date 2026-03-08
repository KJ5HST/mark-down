import Foundation

/// Self-contained markdown-to-HTML converter for the Quick Look extension.
/// No external dependencies — parses common markdown and GFM features.
enum MarkdownToHTML {

    static func convert(_ markdown: String) -> String {
        let body = convertBody(markdown)
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
        \(css)
        </style>
        </head>
        <body>
        <article>
        \(body)
        </article>
        </body>
        </html>
        """
    }

    // MARK: - Block-level parsing

    private static func convertBody(_ markdown: String) -> String {
        let lines = markdown.components(separatedBy: "\n")
        var html = ""
        var i = 0

        while i < lines.count {
            let line = lines[i]

            // Fenced code block
            if line.hasPrefix("```") {
                let lang = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                let langAttr = lang.isEmpty ? "" : " class=\"language-\(escapeHTML(lang))\""
                var code = ""
                i += 1
                while i < lines.count && !lines[i].hasPrefix("```") {
                    if !code.isEmpty { code += "\n" }
                    code += escapeHTML(lines[i])
                    i += 1
                }
                i += 1 // skip closing ```
                html += "<pre><code\(langAttr)>\(code)</code></pre>\n"
                continue
            }

            // Heading
            if let (level, text) = parseHeading(line) {
                html += "<h\(level)>\(processInline(text))</h\(level)>\n"
                i += 1
                continue
            }

            // Horizontal rule
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.count >= 3 && (
                trimmed.allSatisfy({ $0 == "-" || $0 == " " }) && trimmed.contains("-") ||
                trimmed.allSatisfy({ $0 == "*" || $0 == " " }) && trimmed.contains("*") ||
                trimmed.allSatisfy({ $0 == "_" || $0 == " " }) && trimmed.contains("_")
            ) && trimmed.filter({ $0 != " " }).count >= 3 {
                // Make sure it's not a heading underline or list item
                if !trimmed.hasPrefix("- ") && !trimmed.hasPrefix("* ") {
                    html += "<hr>\n"
                    i += 1
                    continue
                }
            }

            // Blockquote
            if line.hasPrefix("> ") || line == ">" {
                var quoteLines: [String] = []
                while i < lines.count && (lines[i].hasPrefix("> ") || lines[i] == ">") {
                    let content = lines[i].hasPrefix("> ") ? String(lines[i].dropFirst(2)) : ""
                    quoteLines.append(content)
                    i += 1
                }
                let inner = convertBody(quoteLines.joined(separator: "\n"))
                html += "<blockquote>\(inner)</blockquote>\n"
                continue
            }

            // Unordered list
            if isUnorderedListItem(line) {
                html += parseUnorderedList(lines: lines, index: &i)
                continue
            }

            // Ordered list
            if isOrderedListItem(line) {
                html += parseOrderedList(lines: lines, index: &i)
                continue
            }

            // Table
            if i + 1 < lines.count && isTableSeparator(lines[i + 1]) && line.contains("|") {
                html += parseTable(lines: lines, index: &i)
                continue
            }

            // Empty line
            if trimmed.isEmpty {
                i += 1
                continue
            }

            // Paragraph — collect consecutive non-empty, non-block lines
            var paraLines: [String] = []
            while i < lines.count {
                let l = lines[i]
                let t = l.trimmingCharacters(in: .whitespaces)
                if t.isEmpty || l.hasPrefix("```") || parseHeading(l) != nil ||
                   l.hasPrefix("> ") || isUnorderedListItem(l) || isOrderedListItem(l) ||
                   (i + 1 < lines.count && isTableSeparator(lines[i + 1]) && l.contains("|")) {
                    break
                }
                // Check for horizontal rule (but not list items)
                if t.count >= 3 && !t.hasPrefix("- ") && !t.hasPrefix("* ") && (
                    (t.allSatisfy({ $0 == "-" || $0 == " " }) && t.filter({ $0 == "-" }).count >= 3) ||
                    (t.allSatisfy({ $0 == "*" || $0 == " " }) && t.filter({ $0 == "*" }).count >= 3) ||
                    (t.allSatisfy({ $0 == "_" || $0 == " " }) && t.filter({ $0 == "_" }).count >= 3)
                ) {
                    break
                }
                paraLines.append(l)
                i += 1
            }
            if !paraLines.isEmpty {
                let text = paraLines.joined(separator: "\n")
                html += "<p>\(processInline(text))</p>\n"
            }
        }

        return html
    }

    private static func parseHeading(_ line: String) -> (Int, String)? {
        var level = 0
        for ch in line {
            if ch == "#" { level += 1 } else { break }
        }
        guard level >= 1 && level <= 6 && line.count > level && line[line.index(line.startIndex, offsetBy: level)] == " " else {
            return nil
        }
        let text = String(line.dropFirst(level + 1))
        return (level, text)
    }

    private static func isUnorderedListItem(_ line: String) -> Bool {
        return line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("+ ")
    }

    private static func isOrderedListItem(_ line: String) -> Bool {
        guard let dotIndex = line.firstIndex(of: ".") else { return false }
        let prefix = line[line.startIndex..<dotIndex]
        guard !prefix.isEmpty && prefix.allSatisfy({ $0.isNumber }) else { return false }
        let afterDot = line.index(after: dotIndex)
        return afterDot < line.endIndex && line[afterDot] == " "
    }

    private static func parseUnorderedList(lines: [String], index i: inout Int) -> String {
        var html = "<ul>\n"
        while i < lines.count && isUnorderedListItem(lines[i]) {
            let content = String(lines[i].dropFirst(2))
            let (checkbox, text) = parseTaskListItem(content)
            html += "<li>\(checkbox)\(processInline(text))</li>\n"
            i += 1
        }
        html += "</ul>\n"
        return html
    }

    private static func parseOrderedList(lines: [String], index i: inout Int) -> String {
        var html = "<ol>\n"
        while i < lines.count && isOrderedListItem(lines[i]) {
            if let dotIndex = lines[i].firstIndex(of: ".") {
                let content = String(lines[i][lines[i].index(dotIndex, offsetBy: 2)...])
                html += "<li>\(processInline(content))</li>\n"
            }
            i += 1
        }
        html += "</ol>\n"
        return html
    }

    private static func parseTaskListItem(_ text: String) -> (String, String) {
        if text.hasPrefix("[x] ") || text.hasPrefix("[X] ") {
            return ("<input type=\"checkbox\" checked disabled> ", String(text.dropFirst(4)))
        } else if text.hasPrefix("[ ] ") {
            return ("<input type=\"checkbox\" disabled> ", String(text.dropFirst(4)))
        }
        return ("", text)
    }

    private static func isTableSeparator(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("|") else { return false }
        let cells = splitTableRow(trimmed)
        return cells.allSatisfy { cell in
            let c = cell.trimmingCharacters(in: .whitespaces)
            return c.allSatisfy({ $0 == "-" || $0 == ":" }) && c.contains("-")
        }
    }

    private static func splitTableRow(_ line: String) -> [String] {
        var row = line
        if row.hasPrefix("|") { row = String(row.dropFirst()) }
        if row.hasSuffix("|") { row = String(row.dropLast()) }
        return row.components(separatedBy: "|")
    }

    private static func parseTable(lines: [String], index i: inout Int) -> String {
        var html = "<table>\n"

        // Header
        let headerCells = splitTableRow(lines[i])
        html += "<thead><tr>\n"
        for cell in headerCells {
            html += "<th>\(processInline(cell.trimmingCharacters(in: .whitespaces)))</th>\n"
        }
        html += "</tr></thead>\n"
        i += 1

        // Skip separator
        i += 1

        // Body rows
        html += "<tbody>\n"
        while i < lines.count && lines[i].contains("|") {
            let cells = splitTableRow(lines[i])
            html += "<tr>\n"
            for cell in cells {
                html += "<td>\(processInline(cell.trimmingCharacters(in: .whitespaces)))</td>\n"
            }
            html += "</tr>\n"
            i += 1
        }
        html += "</tbody>\n</table>\n"
        return html
    }

    // MARK: - Inline processing

    private static func processInline(_ text: String) -> String {
        var result = escapeHTML(text)

        // Images: ![alt](src)
        result = replacePattern(in: result, pattern: #"!\[([^\]]*)\]\(([^)]+)\)"#) { match in
            let alt = match[1]
            let src = match[2]
            return "<img src=\"\(src)\" alt=\"\(alt)\">"
        }

        // Links: [text](url)
        result = replacePattern(in: result, pattern: #"\[([^\]]+)\]\(([^)]+)\)"#) { match in
            let text = match[1]
            let url = match[2]
            return "<a href=\"\(url)\">\(text)</a>"
        }

        // Bold: **text** or __text__
        result = replacePattern(in: result, pattern: #"\*\*(.+?)\*\*"#) { match in
            "<strong>\(match[1])</strong>"
        }
        result = replacePattern(in: result, pattern: #"__(.+?)__"#) { match in
            "<strong>\(match[1])</strong>"
        }

        // Strikethrough: ~~text~~
        result = replacePattern(in: result, pattern: #"~~(.+?)~~"#) { match in
            "<del>\(match[1])</del>"
        }

        // Italic: *text* or _text_
        result = replacePattern(in: result, pattern: #"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)"#) { match in
            "<em>\(match[1])</em>"
        }
        result = replacePattern(in: result, pattern: #"(?<!_)_(?!_)(.+?)(?<!_)_(?!_)"#) { match in
            "<em>\(match[1])</em>"
        }

        // Inline code: `code`
        result = replacePattern(in: result, pattern: #"`([^`]+)`"#) { match in
            "<code>\(match[1])</code>"
        }

        // Line breaks
        result = result.replacingOccurrences(of: "\n", with: "<br>\n")

        return result
    }

    private static func escapeHTML(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private static func replacePattern(
        in string: String,
        pattern: String,
        replacement: ([String]) -> String
    ) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return string }
        let nsString = string as NSString
        var result = string
        let matches = regex.matches(in: string, range: NSRange(location: 0, length: nsString.length))

        // Process in reverse to preserve ranges
        for match in matches.reversed() {
            var groups: [String] = []
            for g in 0..<match.numberOfRanges {
                let range = match.range(at: g)
                if range.location != NSNotFound {
                    groups.append(nsString.substring(with: range))
                } else {
                    groups.append("")
                }
            }
            let replaced = replacement(groups)
            let range = match.range(at: 0)
            let startIndex = result.index(result.startIndex, offsetBy: range.location)
            let endIndex = result.index(startIndex, offsetBy: range.length)
            result.replaceSubrange(startIndex..<endIndex, with: replaced)
        }

        return result
    }

    // MARK: - Embedded CSS

    private static let css = """
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: #000;
        background: #fff;
        padding: 24px 32px;
        -webkit-text-size-adjust: 100%;
    }
    article {
        max-width: 800px;
        margin: 0 auto;
    }

    /* Headings — matching DefaultStyles.swift */
    h1 {
        font-size: 32px;
        font-weight: 700;
        margin-top: 16px;
        margin-bottom: 8px;
        line-height: 1.2;
    }
    h2 {
        font-size: 26px;
        font-weight: 700;
        margin-top: 14px;
        margin-bottom: 6px;
        line-height: 1.25;
    }
    h3 {
        font-size: 22px;
        font-weight: 600;
        margin-top: 12px;
        margin-bottom: 4px;
        line-height: 1.3;
    }
    h4 {
        font-size: 18px;
        font-weight: 600;
        margin-top: 10px;
        margin-bottom: 4px;
        line-height: 1.35;
    }
    h5 {
        font-size: 16px;
        font-weight: 500;
        margin-top: 8px;
        margin-bottom: 2px;
    }
    h6 {
        font-size: 14px;
        font-weight: 500;
        color: #666;
        margin-top: 8px;
        margin-bottom: 2px;
    }

    /* Paragraph */
    p {
        margin-bottom: 4px;
        padding-left: 8px;
        line-height: 1.6;
    }

    /* Blockquote */
    blockquote {
        font-style: italic;
        color: #4d4d4d;
        background: #f5f5f5;
        padding: 8px 8px 8px 16px;
        margin: 8px 0;
        border-left: 3px solid #bfbfbf;
        border-radius: 2px;
    }
    blockquote p {
        padding-left: 0;
        margin-bottom: 0;
    }

    /* Code blocks */
    pre {
        background: #f2f2f2;
        padding: 12px;
        margin: 8px 0;
        border-radius: 6px;
        overflow-x: auto;
    }
    pre code {
        font-family: "SF Mono", SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        color: #333;
        background: none;
        padding: 0;
        border-radius: 0;
    }

    /* Inline code */
    code {
        font-family: "SF Mono", SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        color: #cc2649;
        background: #f2f2f2;
        padding: 1px 4px;
        border-radius: 3px;
    }

    /* Lists */
    ul, ol {
        padding: 4px 0 4px 8px;
        margin-left: 20px;
    }
    li {
        margin: 2px 0;
        font-size: 14px;
    }
    li input[type="checkbox"] {
        margin-right: 6px;
    }

    /* Horizontal rule */
    hr {
        border: none;
        border-top: 1px solid #ccc;
        margin: 12px 0;
    }

    /* Tables */
    table {
        border-collapse: collapse;
        width: 100%;
        margin: 8px 0;
        font-size: 13px;
    }
    th {
        font-weight: 600;
        background: #f2f2f2;
        padding: 6px 8px;
        text-align: left;
        border: 1px solid #d9d9d9;
    }
    td {
        padding: 4px 8px;
        border: 1px solid #d9d9d9;
    }

    /* Links */
    a {
        color: #0066cc;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }

    /* Images */
    img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        margin: 8px 0;
    }

    /* Strikethrough */
    del {
        color: #808080;
    }

    """
}
