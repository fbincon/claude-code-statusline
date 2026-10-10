"""Grapheme-aware capture using the independent wcwidth reference.

pyte handles terminal controls; this adapter replaces code-point-only drawing.
Raw PTY bytes remain authoritative alongside the decoded cell view.
"""

import pyte
from pyte import modes as mo
from wcwidth import iter_graphemes, wcswidth

Stream = pyte.Stream


class Screen(pyte.Screen):
    @property
    def display(self):
        return [
            "".join(self.buffer[y][x].data for x in range(self.columns))
            for y in range(self.lines)
        ]

    def draw(self, data):
        data = data.translate(self.g1_charset if self.charset else self.g0_charset)
        tail = getattr(self, "_grapheme_tail", None)
        if tail:
            y, x, value, width, attrs, end_y, end_x = tail
            if (self.cursor.y, self.cursor.x) == (end_y, end_x) and self.buffer[y][
                x
            ].data == value:
                groups = list(iter_graphemes(value + data))
                if groups and len(groups[0]) > len(value):
                    combined = groups[0]
                    data = data[len(combined) - len(value) :]
                    for column in range(x, min(self.columns, x + width)):
                        self.buffer[y][column] = attrs._replace(data=" ")
                    self.cursor.y, self.cursor.x = y, x
                    self._paint(combined, attrs)
        for cluster in iter_graphemes(data):
            self._paint(cluster, self.cursor.attrs)

    def _paint(self, cluster, attrs):
        width = max(0, wcswidth(cluster))
        if width == 0:
            return  # Orphan zero-cell clusters remain in the raw capture.
        if self.cursor.x + width > self.columns:
            if mo.DECAWM in self.mode:
                self.carriage_return()
                self.linefeed()
            else:
                self.cursor.x = max(0, self.columns - width)
        if mo.IRM in self.mode:
            self.insert_characters(width)
        y, x = self.cursor.y, self.cursor.x
        self.buffer[y][x] = attrs._replace(data=cluster)
        for continuation in range(1, min(width, self.columns - x)):
            self.buffer[y][x + continuation] = attrs._replace(data="")
        self.cursor.x = min(self.columns, x + width)
        self.dirty.add(y)
        self._grapheme_tail = (
            y,
            x,
            cluster,
            width,
            attrs,
            self.cursor.y,
            self.cursor.x,
        )
