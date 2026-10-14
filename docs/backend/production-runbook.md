# Quy trÃ¬nh Ä‘Æ°a website vÃ o production

## Äiá»u kiá»‡n báº¯t buá»™c

- MongoDB lÃ  replica set vÃ  database má»¥c tiÃªu hoÃ n toÃ n má»›i.
- DATABASE_BOOTSTRAP_MODE=fresh-only; khÃ´ng há»— trá»£ legacy-adopt.
- Redis vÃ  object storage dÃ¹ng secret production riÃªng.
- Cáº¥u hÃ¬nh CEO_EMAIL, CEO_FULL_NAME, CEO_PHONE vÃ 
  CEO_BOOTSTRAP_PASSWORD qua secret manager.
- API/worker chá»‰ khá»Ÿi Ä‘á»™ng sau storage-init, database-bootstrap vÃ 
  database-verify thÃ nh cÃ´ng.

## Khá»Ÿi táº¡o database website-only

database-bootstrap khÃ´ng xÃ³a hay adopt dá»¯ liá»‡u. Náº¿u database cÃ³ báº¥t ká»³
báº£n ghi nÃ o mÃ  chÆ°a cÃ³ marker fresh-bootstrap / website-only-v1, job
dá»«ng ngay vÃ  giá»¯ nguyÃªn dá»¯ liá»‡u.

Baseline táº¡o:

- má»™t tÃ i khoáº£n CEO Ä‘á»™c láº­p, Ä‘Æ°á»£c báº£o vá»‡;
- policy vÃ  email template Identity;
- preset quyá»n ADMIN/MARKETING;
- 10 trang CMS, website settings vÃ  media reference máº·c Ä‘á»‹nh;
- chá»‰ index Identity, Marketing vÃ  Website.

Cháº¡y theo thá»© tá»±:

    python -m scripts.database_bootstrap
    python -m scripts.database_bootstrap
    python -m scripts.database_verify
    python -m scripts.database_fresh_verify

Cáº£ bá»‘n lá»‡nh pháº£i thÃ nh cÃ´ng. Láº§n bootstrap thá»© hai pháº£i idempotent.

## TrÃ¬nh tá»± má»Ÿ dá»‹ch vá»¥

1. Build image báº±ng commit SHA báº¥t biáº¿n vÃ  cháº¡y toÃ n bá»™ production gates.
2. Khá»Ÿi Ä‘á»™ng MongoDB, Redis vÃ  object storage.
3. Cháº¡y storage/bootstrap/verify nhÆ° trÃªn.
4. Khá»Ÿi Ä‘á»™ng API vÃ  worker; xÃ¡c nháº­n /health/ready.
5. Khá»Ÿi Ä‘á»™ng frontend vÃ  reverse proxy.
6. ÄÄƒng nháº­p CEO, Ä‘á»•i máº­t kháº©u ngay, rá»“i xÃ³a
   CEO_BOOTSTRAP_PASSWORD khá»i environment runtime.
7. Táº¡o ADMIN/MARKETING, nháº­p dá»± Ã¡n, bÃ i viáº¿t, Ä‘á»™i ngÅ©, tuyá»ƒn dá»¥ng
   vÃ  workspace qua CMS.
8. Smoke test form lead/kÃ½ gá»­i, upload media, publish/unpublish, SMTP, sitemap
   vÃ  giao diá»‡n mobile.
9. Chá»‰ má»Ÿ traffic sau khi smoke test Ä‘áº¡t; táº¡o backup Ä‘áº§u tiÃªn ngay sau
   khi ná»™i dung production Ä‘Æ°á»£c xÃ¡c nháº­n.

Nguá»“n quy trÃ¬nh chi tiáº¿t: docs/TAI_LIEU_NGHIEP_VU_MAIAN_HOMES.md.
