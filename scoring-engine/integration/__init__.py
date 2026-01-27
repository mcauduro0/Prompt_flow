"""
ARC Scoring Engine - Integration Layer
Bridges with existing ARC system.
"""

from .arc_integration import (
    get_db_connection,
    load_ic_memos_from_db,
    load_companies_from_db,
    update_ic_memo_scores,
    batch_update_scores,
    sync_scores_to_arc,
    export_scores_for_frontend,
    generate_scoring_report,
    get_recommendation
)

__all__ = [
    'get_db_connection',
    'load_ic_memos_from_db',
    'load_companies_from_db',
    'update_ic_memo_scores',
    'batch_update_scores',
    'sync_scores_to_arc',
    'export_scores_for_frontend',
    'generate_scoring_report',
    'get_recommendation'
]
