"""Pause-aware elapsed time, independent of storage, rendering and host events.

The accumulated/resume model follows Codex's StatusTimer. Samples retain their
boot domain so a serialized clock can safely outlive its Python process.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace


@dataclass(frozen=True)
class Sample:
    wall_ns: int
    boot_ns: int | None = None
    boot_id: str | None = None

    @classmethod
    def load(cls, value):
        if not isinstance(value, dict) or type(value.get("wall_ns")) is not int:
            return None
        boot = value.get("boot_ns")
        domain = value.get("boot_id")
        return cls(
            value["wall_ns"],
            boot if type(boot) is int else None,
            domain if isinstance(domain, str) and domain else None,
        )


def delta(start: Sample, end: Sample) -> int | None:
    """Prefer suspend-aware uptime; reject backwards or incompatible samples."""
    if start.boot_id and start.boot_id == end.boot_id:
        if start.boot_ns is not None and end.boot_ns is not None:
            value = end.boot_ns - start.boot_ns
            return value if value >= 0 else None
    value = end.wall_ns - start.wall_ns
    return value if value >= 0 else None


@dataclass(frozen=True)
class StatusTimer:
    accumulated_ns: int
    last_resume: Sample
    waits: tuple[str, ...] = ()
    frozen_ns: int | None = None
    degraded: bool = False

    @classmethod
    def start(cls, now: Sample):
        return cls(0, now)

    @classmethod
    def load(cls, value):
        if not isinstance(value, dict):
            return None
        sample = Sample.load(value.get("last_resume"))
        elapsed = value.get("accumulated_ns")
        waits = value.get("waits", [])
        frozen = value.get("frozen_ns")
        degraded = value.get("degraded", False)
        if (
            sample is None
            or type(elapsed) is not int
            or elapsed < 0
            or not isinstance(waits, list)
            or any(not isinstance(w, str) or not w for w in waits)
            or len(waits) > 256
            or (frozen is not None and (type(frozen) is not int or frozen < 0))
            or type(degraded) is not bool
        ):
            return None
        return cls(elapsed, sample, tuple(dict.fromkeys(waits)), frozen, degraded)

    def to_dict(self):
        value = asdict(self)
        value["waits"] = list(self.waits)
        return value

    def elapsed(self, now: Sample) -> int | None:
        if self.frozen_ns is not None:
            return self.frozen_ns
        if self.waits:
            return self.accumulated_ns
        current = delta(self.last_resume, now)
        return None if current is None else self.accumulated_ns + current

    def reset(self, now: Sample, elapsed_ns=0):
        # A turn can start while a question remains open, as in Codex's reset.
        return replace(self, accumulated_ns=elapsed_ns, last_resume=now, frozen_ns=None)

    def pause(self, token: str, now: Sample):
        if self.frozen_ns is not None or token in self.waits:
            return self
        elapsed = self.elapsed(now)
        if elapsed is None or len(self.waits) >= 256:
            return replace(self, degraded=True)
        return replace(
            self,
            accumulated_ns=elapsed,
            waits=(*self.waits, token),
            last_resume=now,
            degraded=self.degraded or not self.trusted_sample(now),
        )

    def resume(self, token: str, now: Sample):
        if self.frozen_ns is not None or token not in self.waits:
            return self
        waits = tuple(w for w in self.waits if w != token)
        return replace(
            self,
            waits=waits,
            last_resume=now,
            degraded=self.degraded or not self.trusted_sample(now),
        )

    def trusted_sample(self, now: Sample) -> bool:
        """Execution time requires uninterrupted evidence in one boot domain."""
        start = self.last_resume
        return bool(
            start.boot_id
            and start.boot_id == now.boot_id
            and start.boot_ns is not None
            and now.boot_ns is not None
            and now.boot_ns >= start.boot_ns
        )

    def reopen(self):
        return replace(self, frozen_ns=None)

    def finish(self, now: Sample):
        if self.frozen_ns is not None:
            return self
        return replace(
            self,
            frozen_ns=self.elapsed(now),
            degraded=self.degraded or not self.trusted_sample(now),
        )


def task_elapsed(record, now: Sample):
    """Read one task clock without repairing or modifying its lifecycle."""
    if record.get("status") != "running" and type(record.get("duration_ns")) is int:
        return record["duration_ns"]
    candidate = record.get("stop_candidate")
    if record.get("phase") == "stop_pending" and isinstance(candidate, dict):
        return candidate.get("duration_ns")
    start = record.get("started_wall_ns")
    if type(start) is not int:
        return None
    end = (
        now
        if record.get("status") == "running"
        else Sample(
            record.get("ended_wall_ns"),
            record.get("ended_boot_ns"),
            record.get("boot_id"),
        )
    )
    if type(end.wall_ns) is not int:
        return None
    return delta(
        Sample(start, record.get("started_boot_ns"), record.get("boot_id")), end
    )
