"""
Pipeline orchestrator — runs all pipeline stages in sequence.

Usage:
  python run_pipeline.py              # full pipeline (scrape → normalise → dedup → cluster → score → explain)
  python run_pipeline.py --scrape     # only scrape
  python run_pipeline.py --normalise  # only normalise
  python run_pipeline.py --dedup      # only dedup
  python run_pipeline.py --cluster    # only cluster + archive
  python run_pipeline.py --score      # only score
  python run_pipeline.py --explain    # only AI explainer (fills editor_queue ai_* fields)
  python run_pipeline.py --breaking   # only breaking detector + auto-defer (run every 5 min)

Cron examples:
  */15 * * * * cd /path/to/pipeline && python run_pipeline.py --scrape --normalise
  */30 * * * * cd /path/to/pipeline && python run_pipeline.py --dedup --cluster --score --explain
  */5  * * * * cd /path/to/pipeline && python run_pipeline.py --breaking
  0 */6 * * *  cd /path/to/pipeline && python run_pipeline.py   # full pass every 6h
"""

import argparse
import logging
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pipeline")


def run_scrape():
    logger.info("=== STAGE 1: Scraping ===")
    from scraper import scrape_all_active
    t0 = time.time()
    results = scrape_all_active()
    total = sum(results.values())
    logger.info("Scrape complete in %.1fs — %d new articles", time.time() - t0, total)
    for slug, count in sorted(results.items()):
        if count:
            logger.info("  %s: %d", slug, count)
    return total


def run_normalise():
    logger.info("=== STAGE 2: Normalising ===")
    from normaliser import process_unprocessed
    t0 = time.time()
    n = process_unprocessed()
    logger.info("Normalise complete in %.1fs — %d articles processed", time.time() - t0, n)
    return n


def run_dedup():
    logger.info("=== STAGE 3: Deduplication ===")
    from dedup import run_dedup as _run_dedup
    t0 = time.time()
    result = _run_dedup()
    logger.info(
        "Dedup complete in %.1fs — hash_dups=%d title_dups=%d",
        time.time() - t0, result["hash_dups"], result["title_dups"],
    )
    return result


def run_cluster():
    logger.info("=== STAGE 4: Clustering ===")
    from clustering import run_clustering, archive_old_clusters
    t0 = time.time()
    result = run_clustering()
    archived = archive_old_clusters()
    logger.info(
        "Cluster complete in %.1fs — assigned=%d new_clusters=%d archived=%d",
        time.time() - t0, result["assigned"], result["new_clusters"], archived,
    )
    return result


def run_score():
    logger.info("=== STAGE 5: OzScore ===")
    from ozscore import score_all_active
    t0 = time.time()
    n = score_all_active()
    logger.info("Score complete in %.1fs — %d clusters scored", time.time() - t0, n)
    return n


def run_explain():
    logger.info("=== STAGE 6: AI Explainer ===")
    from explainer import generate_all_pending
    t0 = time.time()
    n = generate_all_pending()
    logger.info("Explain complete in %.1fs — %d queue item(s) generated", time.time() - t0, n)
    return n


def run_breaking_stage():
    logger.info("=== STAGE 7: Breaking Detector ===")
    from breaking import run_breaking
    t0 = time.time()
    result = run_breaking()
    logger.info(
        "Breaking complete in %.1fs — created=%d deferred=%d",
        time.time() - t0, result["breaking_created"], result["deferred"],
    )
    return result


def main():
    parser = argparse.ArgumentParser(description="OzShorts pipeline runner")
    parser.add_argument("--scrape",    action="store_true", help="Run scrape stage")
    parser.add_argument("--normalise", action="store_true", help="Run normalise stage")
    parser.add_argument("--dedup",     action="store_true", help="Run dedup stage")
    parser.add_argument("--cluster",   action="store_true", help="Run clustering stage")
    parser.add_argument("--score",     action="store_true", help="Run scoring stage")
    parser.add_argument("--explain",   action="store_true", help="Run AI explainer stage")
    parser.add_argument("--breaking",  action="store_true", help="Run breaking detector")
    args = parser.parse_args()

    # If no specific stage flags → run all stages (except breaking — that has its own cron)
    run_all = not any([
        args.scrape, args.normalise, args.dedup, args.cluster,
        args.score, args.explain, args.breaking,
    ])

    t_start = time.time()
    logger.info("Pipeline starting")

    try:
        if run_all or args.scrape:
            run_scrape()
        if run_all or args.normalise:
            run_normalise()
        if run_all or args.dedup:
            run_dedup()
        if run_all or args.cluster:
            run_cluster()
        if run_all or args.score:
            run_score()
        if run_all or args.explain:
            run_explain()
        if args.breaking:
            run_breaking_stage()
    except Exception as exc:
        logger.error("Pipeline failed: %s", exc, exc_info=True)
        sys.exit(1)

    logger.info("Pipeline complete in %.1fs", time.time() - t_start)


if __name__ == "__main__":
    main()
