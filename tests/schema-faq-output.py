"""Check that every displayed custom FAQ answer participates in the built graph."""
import json
from html.parser import HTMLParser
from pathlib import Path


def decode(value):
    if isinstance(value, list) and len(value) == 2 and isinstance(value[0], int):
        return decode(value[1])
    if isinstance(value, dict):
        return {key: decode(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decode(item) for item in value]
    return value


class Page(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.items, self.graphs, self.answers = [], [], {}
        self.slot, self.depth, self.jsonld, self.script = None, 0, False, ""
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "astro-island" and "FaqAccordion" in attrs.get("component-url", ""):
            self.items.extend(decode(json.loads(attrs["props"]))["items"])
        if tag == "div":
            if "data-bridge-slot" in attrs:
                self.slot, self.depth = attrs["id"], 1
                self.answers[self.slot] = []
            elif self.slot:
                self.depth += 1
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.jsonld, self.script = True, ""

    def handle_endtag(self, tag):
        if tag == "div" and self.slot:
            self.depth -= 1
            if not self.depth:
                self.slot = None
        if tag == "script" and self.jsonld:
            graph = json.loads(self.script)
            self.graphs.extend(graph.get("@graph", [graph]))
            self.jsonld = False
        if self.slot:
            self.answers[self.slot].append(" ")

    def handle_data(self, value):
        if self.jsonld:
            self.script += value
        elif self.slot:
            self.answers[self.slot].append(value)


def plain(markup):
    class Text(HTMLParser):
        def handle_data(self, value):
            parts.append(value)
    parts = []
    Text().feed(markup)
    return " ".join(" ".join(parts).split())


page = Page(Path("dist/client/faq/index.html").read_text())
faqs = [node for node in page.graphs if node.get("@type") == "FAQPage"]
assert len(faqs) == 1, "Expected one collected FAQPage"
questions = faqs[0]["mainEntity"]
assert page.items and len(questions) == len(page.items), "Displayed FAQ coverage is incomplete"
by_title = {question["name"]: question for question in questions}
assert len(by_title) == len(questions), "Duplicate FAQ question names"
for item in page.items:
    answer = by_title[item["title"]]["acceptedAnswer"]["text"]
    visible = " ".join("".join(page.answers[item["contentSlotId"]]).split())
    assert visible and plain(answer) == visible, f"Displayed answer differs: {item['title']}"
print(json.dumps({"faq_questions": len(questions), "displayed_answers_match": True}))
