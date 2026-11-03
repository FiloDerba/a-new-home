-- Current, residential buurten only.
-- The inner join drops the 14 Westpoort port/industrial buurten (BA*, BB*): they have no
-- residents and belong to no gebied.
-- shortcut: no boundary history, so past years are mapped onto today's boundaries;
-- upgrade to a versioned dimension if buurten start changing between years.
select
    buurt.buurt_code,
    buurt.cbs_code,
    buurt.name,
    gebied.gebied_code,
    buurt.geometry
from {{ ref('stg_gebieden__buurten') }} as buurt
inner join {{ ref('stg_gebieden__ggw_gebieden') }} as gebied
    on buurt.ggw_gebied_id = gebied.ggw_gebied_id
    and gebied.is_current
where buurt.is_current
