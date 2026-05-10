#!/usr/bin/env python3
"""One-way exact mirror from pp-core + pp-hardware into pp-devlab.

This uses the NotebookLM Python client directly because the public `nlm source
add` command can hang while source adds still succeed through the underlying
client with a longer RPC timeout.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from notebooklm_tools.cli.utils import get_client
import notebooklm_tools.core.sources as core_sources


STATE = Path(os.environ.get("PP_NLM_STATE", Path.home() / ".claude/state/pp-nlm"))
LOGS = Path(os.environ.get("PP_NLM_LOGS", Path.home() / ".claude/logs"))
CACHE_DIR = Path(
    os.environ.get("PP_NLM_DEVLAB_CACHE", Path.home() / ".cache/pp-nlm/devlab-source-content")
)
MIRROR_MANIFEST = Path(
    os.environ.get("PP_NLM_DEVLAB_MANIFEST", STATE / "devlab-mirror-manifest.json")
)
NOTEBOOK_MANIFEST = STATE / "notebook-manifest.json"
LOG = LOGS / "pp-nlm-devlab-sync.log"

TARGET_ALIAS = "pp-devlab"
TARGET_TITLE = "ProtoPulse :: DevLab Sandbox"
TARGET_ID = "d4188389-eef8-4aa3-a27d-1fed3f8cf444"
ORIGINS = {
    "pp-core": {
        "id": "7565a078-8051-43ea-8512-c54c3b4d363e",
        "label": "Core",
    },
    "pp-hardware": {
        "id": "bb95833a-926e-47b1-8f45-d23427fbc58d",
        "label": "Hardware",
    },
}
UNRESOLVED_STATUSES = {"content_failed", "add_failed", "add_unknown"}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def log(message: str) -> None:
    LOGS.mkdir(parents=True, exist_ok=True)
    line = f"{now()} {message}"
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


def safe_filename(value: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    return clean[:140] or "untitled"


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def source_title(source: dict[str, Any]) -> str:
    return (
        source.get("title")
        or source.get("name")
        or source.get("displayName")
        or source.get("display_name")
        or "Untitled source"
    )


def source_id(source: dict[str, Any]) -> str:
    return source.get("id") or source.get("source_id") or source.get("sourceId") or ""


def mirror_title(origin_label: str, title: str, sid: str) -> str:
    return f"{origin_label} Mirror :: {title} [{sid[:8]}]"


def metadata_gap_title(origin_label: str, title: str, sid: str) -> str:
    return f"{origin_label} Mirror Metadata Gap :: {title} [{sid[:8]}]"


def compose_mirror_text(
    origin_alias: str,
    sid: str,
    title: str,
    source_type: str,
    url: str | None,
    content: str,
) -> str:
    return "\n".join(
        [
            "# ProtoPulse DevLab Mirror Source",
            "",
            "Mirror schema: protopulse-devlab-exact-mirror-v1",
            f"Origin hub: {origin_alias}",
            f"Origin source ID: {sid}",
            f"Origin source title: {title}",
            f"Origin source type: {source_type}",
            f"Origin URL: {url or 'none'}",
            f"Mirrored at: {now()}",
            "",
            "---",
            "",
            "BEGIN ORIGIN SOURCE CONTENT",
            content,
            "END ORIGIN SOURCE CONTENT",
            "",
        ]
    )


def compose_metadata_gap_text(
    origin_alias: str,
    sid: str,
    title: str,
    source_type: str,
    url: str | None,
    error: str,
) -> str:
    return "\n".join(
        [
            "# ProtoPulse DevLab Mirror Metadata Gap",
            "",
            "Mirror schema: protopulse-devlab-metadata-gap-v1",
            f"Origin hub: {origin_alias}",
            f"Origin source ID: {sid}",
            f"Origin source title: {title}",
            f"Origin source type: {source_type}",
            f"Origin URL: {url or 'none'}",
            f"Checked at: {now()}",
            "",
            "---",
            "",
            "The origin source appears in the live NotebookLM source list, but NotebookLM did not return source content.",
            "This DevLab source is a non-canonical gap marker, not a substitute for the missing article/source body.",
            "",
            f"Last content error: {error}",
            "",
        ]
    )


def update_notebook_manifest() -> None:
    manifest = load_json(NOTEBOOK_MANIFEST, {})
    manifest[TARGET_ALIAS] = {
        "id": TARGET_ID,
        "title": TARGET_TITLE,
        "devlab": True,
        "private_sandbox": True,
        "canonical": False,
        "updated": now(),
    }
    write_json(NOTEBOOK_MANIFEST, manifest)


def record_source(
    manifest: dict[str, Any],
    *,
    key: str,
    origin_alias: str,
    origin_id: str,
    origin_title: str,
    origin_type: str,
    origin_url: str | None,
    mirror_title_value: str,
    mirror_source_id: str | None,
    content_hash: str | None,
    status: str,
    cache_path: Path | None,
    error: str | None = None,
) -> None:
    manifest.setdefault("sources", {})[key] = {
        "origin_alias": origin_alias,
        "origin_id": origin_id,
        "origin_title": origin_title,
        "origin_type": origin_type,
        "origin_url": origin_url,
        "target_alias": TARGET_ALIAS,
        "target_id": TARGET_ID,
        "mirror_title": mirror_title_value,
        "mirror_source_id": mirror_source_id,
        "content_hash": content_hash,
        "status": status,
        "cache_path": str(cache_path) if cache_path else None,
        "last_error": error,
        "updated": now(),
    }
    manifest["target_alias"] = TARGET_ALIAS
    manifest["target_id"] = TARGET_ID
    manifest["updated"] = now()


def find_target_by_title(target_sources: list[dict[str, Any]], title: str) -> str | None:
    for source in target_sources:
        if source_title(source) == title:
            return source_id(source)
    return None


def reconcile_missing_origin_sources(
    manifest: dict[str, Any],
    origin_alias: str,
    origin_sources: list[dict[str, Any]],
) -> int:
    live_ids = {source_id(source) for source in origin_sources if source_id(source)}
    reconciled = 0
    for key, row in list(manifest.get("sources", {}).items()):
        if row.get("origin_alias") != origin_alias:
            continue
        if row.get("status") not in UNRESOLVED_STATUSES:
            continue
        origin_id = row.get("origin_id") or key.split(":", 1)[-1]
        if origin_id in live_ids:
            continue
        record_source(
            manifest,
            key=key,
            origin_alias=origin_alias,
            origin_id=origin_id,
            origin_title=row.get("origin_title") or "Unknown missing origin source",
            origin_type=row.get("origin_type") or "unknown",
            origin_url=row.get("origin_url"),
            mirror_title_value=row.get("mirror_title") or "Missing origin source",
            mirror_source_id=row.get("mirror_source_id"),
            content_hash=row.get("content_hash"),
            status="origin_missing",
            cache_path=Path(row["cache_path"]) if row.get("cache_path") else None,
            error="origin source no longer appears in the live origin source list",
        )
        log(f"reconciled missing origin: {key} {row.get('origin_title') or origin_id}")
        reconciled += 1
    return reconciled


def get_source_content(
    client: Any,
    sid: str,
    *,
    attempts: int,
    retry_sleep: float,
) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            data = client.get_source_fulltext(sid)
            if not isinstance(data, dict):
                raise RuntimeError(f"unexpected source content result for {sid}: {type(data)!r}")
            content = data.get("content") or ""
            if not content.strip():
                raise RuntimeError(f"empty source content for {sid}")
            return data
        except Exception as exc:
            last_error = exc
            if attempt >= attempts:
                break
            sleep_for = retry_sleep * attempt
            log(f"WARN content fetch retry {attempt}/{attempts}: {sid} :: {exc}")
            time.sleep(sleep_for)
    raise RuntimeError(f"source content fetch failed after {attempts} attempts: {last_error}")


def sync_origin(
    client: Any,
    manifest: dict[str, Any],
    target_sources: list[dict[str, Any]],
    origin_alias: str,
    *,
    apply: bool,
    max_adds: int | None,
    content_attempts: int,
    content_retry_sleep: float,
) -> int:
    origin = ORIGINS[origin_alias]
    origin_id = origin["id"]
    label = origin["label"]
    log(f"list origin: {origin_alias}")
    origin_sources = client.get_notebook_sources_with_types(origin_id)
    log(f"origin count: {origin_alias} = {len(origin_sources)}")
    if reconcile_missing_origin_sources(manifest, origin_alias, origin_sources):
        write_json(MIRROR_MANIFEST, manifest)

    attempts = 0
    for idx, source in enumerate(origin_sources, start=1):
        sid = source_id(source)
        if not sid:
            continue
        title = source_title(source)
        stype = source.get("source_type_name") or str(source.get("type") or "unknown")
        url = source.get("url")
        key = f"{origin_alias}:{sid}"
        mtitle = mirror_title(label, title, sid)
        gtitle = metadata_gap_title(label, title, sid)
        cached = manifest.get("sources", {}).get(key, {})
        existing_id = find_target_by_title(target_sources, mtitle)
        existing_gap_id = find_target_by_title(target_sources, gtitle)

        if existing_id and cached.get("status") in {"mirrored", "already_present", "mirrored_after_timeout"}:
            log(f"skip mirrored: {origin_alias} {idx}/{len(origin_sources)} {title}")
            continue

        if existing_id:
            record_source(
                manifest,
                key=key,
                origin_alias=origin_alias,
                origin_id=sid,
                origin_title=title,
                origin_type=stype,
                origin_url=url,
                mirror_title_value=mtitle,
                mirror_source_id=existing_id,
                content_hash=cached.get("content_hash"),
                status="already_present",
                cache_path=Path(cached["cache_path"]) if cached.get("cache_path") else None,
            )
            write_json(MIRROR_MANIFEST, manifest)
            log(f"reconciled existing: {origin_alias} {idx}/{len(origin_sources)} {title}")
            continue

        if not apply:
            log(f"would mirror: {origin_alias} {idx}/{len(origin_sources)} {title}")
            continue

        if max_adds is not None and attempts >= max_adds:
            log(f"max adds reached: {max_adds}")
            break

        attempts += 1
        slug = safe_filename(title)
        base = CACHE_DIR / origin_alias / f"{sid}-{slug}"
        raw_path = base.with_suffix(".raw.txt")
        mirror_path = base.with_suffix(".mirror.txt")
        raw_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            if raw_path.exists() and raw_path.stat().st_size > 0:
                content = raw_path.read_text(encoding="utf-8")
            else:
                data = get_source_content(
                    client,
                    sid,
                    attempts=content_attempts,
                    retry_sleep=content_retry_sleep,
                )
                content = data["content"]
                raw_path.write_text(content, encoding="utf-8")
            mirror_text = compose_mirror_text(origin_alias, sid, title, stype, url, content)
            mirror_path.write_text(mirror_text, encoding="utf-8")
            content_hash = sha256_text(mirror_text)
        except Exception as exc:
            log(f"WARN content failed: {origin_alias} {sid} {title} :: {exc}")
            remote_id = existing_gap_id
            status = "metadata_gap"
            gap_text = compose_metadata_gap_text(origin_alias, sid, title, stype, url, str(exc))
            gap_path = base.with_suffix(".metadata-gap.txt")
            gap_path.write_text(gap_text, encoding="utf-8")
            content_hash = sha256_text(gap_text)
            if not remote_id:
                try:
                    log(f"metadata gap add: {origin_alias} {idx}/{len(origin_sources)} {title}")
                    result = client.add_text_source(TARGET_ID, gap_text, gtitle, wait=False)
                    remote_id = result.get("id") if isinstance(result, dict) else None
                except Exception as add_exc:
                    log(f"WARN metadata gap add failed: {origin_alias} {sid} {title} :: {add_exc}")
                    status = "content_failed"
                    remote_id = None
            if not remote_id and status == "metadata_gap":
                target_sources = client.get_notebook_sources_with_types(TARGET_ID)
                remote_id = find_target_by_title(target_sources, gtitle)
            if not remote_id:
                status = "content_failed"
            record_source(
                manifest,
                key=key,
                origin_alias=origin_alias,
                origin_id=sid,
                origin_title=title,
                origin_type=stype,
                origin_url=url,
                mirror_title_value=gtitle if remote_id else mtitle,
                mirror_source_id=remote_id,
                content_hash=content_hash if remote_id else None,
                status=status,
                cache_path=gap_path if remote_id else raw_path,
                error=str(exc),
            )
            write_json(MIRROR_MANIFEST, manifest)
            if remote_id:
                target_sources.append({"id": remote_id, "title": gtitle})
            continue

        try:
            log(f"mirror add: {origin_alias} {idx}/{len(origin_sources)} {title}")
            result = client.add_text_source(TARGET_ID, mirror_text, mtitle, wait=False)
            remote_id = result.get("id") if isinstance(result, dict) else None
            status = "mirrored" if remote_id else "add_unknown"
        except Exception as exc:
            remote_id = None
            status = "add_failed"
            log(f"WARN add failed: {origin_alias} {sid} {title} :: {exc}")

        if not remote_id:
            target_sources = client.get_notebook_sources_with_types(TARGET_ID)
            remote_id = find_target_by_title(target_sources, mtitle)
            if remote_id:
                status = "mirrored_after_timeout"

        record_source(
            manifest,
            key=key,
            origin_alias=origin_alias,
            origin_id=sid,
            origin_title=title,
            origin_type=stype,
            origin_url=url,
            mirror_title_value=mtitle,
            mirror_source_id=remote_id,
            content_hash=content_hash,
            status=status,
            cache_path=mirror_path,
            error=None if remote_id else "source add returned no mirror source id",
        )
        write_json(MIRROR_MANIFEST, manifest)
        if remote_id:
            target_sources.append({"id": remote_id, "title": mtitle})
        time.sleep(1.5)

    return attempts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Mutate NotebookLM")
    parser.add_argument("--dry-run", action="store_true", help="Force read-only dry run")
    parser.add_argument("--only-origin", choices=sorted(ORIGINS), help="Sync only one origin")
    parser.add_argument("--max-adds", type=int, help="Maximum add attempts per origin")
    parser.add_argument("--source-add-timeout", type=float, default=300.0)
    parser.add_argument("--content-fetch-attempts", type=int, default=4)
    parser.add_argument("--content-fetch-retry-sleep", type=float, default=5.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    apply = bool(args.apply and not args.dry_run)
    STATE.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    update_notebook_manifest()
    core_sources.SOURCE_ADD_TIMEOUT = float(args.source_add_timeout)

    manifest = load_json(MIRROR_MANIFEST, {"sources": {}})
    origins = [args.only_origin] if args.only_origin else list(ORIGINS)

    with get_client() as client:
        target_sources = client.get_notebook_sources_with_types(TARGET_ID)
        log(f"target: {TARGET_ALIAS} -> {TARGET_ID} ({len(target_sources)} sources)")
        for origin_alias in origins:
            sync_origin(
                client,
                manifest,
                target_sources,
                origin_alias,
                apply=apply,
                max_adds=args.max_adds,
                content_attempts=max(1, int(args.content_fetch_attempts)),
                content_retry_sleep=max(0.0, float(args.content_fetch_retry_sleep)),
            )

    write_json(MIRROR_MANIFEST, manifest)
    statuses: dict[str, int] = {}
    for row in manifest.get("sources", {}).values():
        statuses[row.get("status", "unknown")] = statuses.get(row.get("status", "unknown"), 0) + 1
    print(json.dumps(statuses, indent=2, sort_keys=True))
    if not apply:
        print("Dry run complete. Re-run with --apply to mutate NotebookLM.")
    print(f"Manifest: {MIRROR_MANIFEST}")
    print(f"Cache: {CACHE_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
