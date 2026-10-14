# Shared service layer

This directory intentionally contains only `base.py`.

`BaseService` provides shared persistence and audit behavior for code that has
not yet moved to a domain repository. New business behavior must be placed in
the owning module under `app/modules`; do not add another catch-all service
file here.
