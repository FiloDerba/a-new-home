-- Survey scores (1-10) exist only at gebied level, so they live in their own fact table.
select
    dim.gebied_code || '-' || kc.year as gebied_year_id,
    dim.gebied_code,
    kc.year,
    max(kc.value) filter (where kc.indicator_id = 'LLEEFBAARBRT_R') as livability_score,
    max(kc.value) filter (where kc.indicator_id = 'VBUURTVEILIG_R') as safety_score
from {{ ref('stg_bbga__kerncijfers') }} as kc
inner join {{ ref('dim_gebied') }} as dim on kc.area_code = dim.gebied_code
group by dim.gebied_code, kc.year
-- Years without a survey (before 2015, and the not-yet-surveyed latest year) carry no scores.
having livability_score is not null or safety_score is not null
