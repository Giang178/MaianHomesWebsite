from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

ALLOWED_TAGS = {
    "p", "br", "strong", "em", "u", "s", "blockquote",
    "ul", "ol", "li", "h2", "h3", "h4", "a", "span", "figure",
    "figcaption", "img", "hr", "code", "pre",
}
VOID_TAGS = {"br", "img", "hr"}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target", "rel"},
    "img": {"src", "alt", "title", "width", "height", "loading", "data-media-id"},
    "span": set(),
    "p": {"data-align"},
    "h2": {"data-align"},
    "h3": {"data-align"},
    "h4": {"data-align"},
    "figure": {"data-media-id", "data-size", "data-align"},
    "figcaption": {"data-caption", "data-credit"},
}

ENUM_ATTRIBUTES = {
    "data-align": {"left", "center", "right"},
    "data-size": {"small", "medium", "full"},
    "loading": {"lazy", "eager"},
}


def _safe_url(value: str) -> bool:
    if value.startswith("//"):
        return False
    if value.startswith(("/", "#")):
        return True
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https", "mailto", "tel"}


def _safe_image_url(value: str) -> bool:
    if value.startswith("//"):
        return False
    parsed = urlparse(value)
    return not parsed.scheme and not parsed.netloc and (
        parsed.path.startswith("/images/")
        or parsed.path.startswith("/api/public/marketing-media/")
    )


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output: list[str] = []
        self.stack: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        tag = tag.lower()
        if tag not in ALLOWED_TAGS:
            return
        clean_attrs: list[str] = []
        opens_new_tab = tag == "a" and any(
            name.lower() == "target" and value == "_blank" for name, value in attrs
        )
        for name, value in attrs:
            name = name.lower()
            if name not in ALLOWED_ATTRIBUTES.get(tag, set()) or value is None:
                continue
            if name == "src" and tag == "img" and not _safe_image_url(value):
                continue
            if name == "href" and not _safe_url(value):
                continue
            if name in ENUM_ATTRIBUTES and value not in ENUM_ATTRIBUTES[name]:
                continue
            if name == "data-media-id" and not value.isalnum():
                continue
            if tag == "a" and name == "target" and value != "_blank":
                continue
            if tag == "a" and name == "rel":
                if opens_new_tab:
                    continue
                tokens = [
                    token for token in value.casefold().split()
                    if token in {"nofollow", "noreferrer", "noopener", "sponsored", "ugc"}
                ]
                if not tokens:
                    continue
                value = " ".join(dict.fromkeys(tokens))
            clean_attrs.append(f'{name}="{escape(value, quote=True)}"')
        if opens_new_tab:
            clean_attrs.append('rel="noopener noreferrer"')
        suffix = (" " + " ".join(clean_attrs)) if clean_attrs else ""
        self.output.append(f"<{tag}{suffix}>")
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_endtag(self, tag: str):
        tag = tag.lower()
        if tag in VOID_TAGS or tag not in ALLOWED_TAGS:
            return
        if tag in self.stack:
            while self.stack:
                current = self.stack.pop()
                self.output.append(f"</{current}>")
                if current == tag:
                    break

    def handle_data(self, data: str):
        self.output.append(escape(data))

    def handle_entityref(self, name: str):
        self.output.append(f"&{name};")

    def close(self):
        super().close()
        while self.stack:
            self.output.append(f"</{self.stack.pop()}>")


def sanitize_marketing_html(value: str) -> str:
    parser = _Sanitizer()
    parser.feed(value or "")
    parser.close()
    return "".join(parser.output)

