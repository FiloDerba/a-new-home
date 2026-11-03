-- One row per buurt and year. Values stay null where the city publishes none; never imputed.
select
    dim.buurt_code || '-' || kc.year as buurt_year_id,
    dim.buurt_code,
    kc.year,
    max(kc.value) filter (where kc.indicator_id = 'WWOZ_GEM') as avg_woz_eur,
    max(kc.value) filter (where kc.indicator_id = 'ORGROEN_P') as green_pct,
    max(kc.value) filter (where kc.indicator_id = 'BEVTOTAAL') as population
from {{ ref('stg_bbga__kerncijfers') }} as kc
inner join {{ ref('dim_buurt') }} as dim on kc.area_code = dim.buurt_code
group by dim.buurt_code, kc.year
