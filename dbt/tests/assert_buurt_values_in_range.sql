-- Returns offending rows; the test passes when none are returned.
select *
from {{ ref('fct_buurt_year') }}
where avg_woz_eur <= 0
    or green_pct < 0
    or green_pct > 100
    or population < 0
