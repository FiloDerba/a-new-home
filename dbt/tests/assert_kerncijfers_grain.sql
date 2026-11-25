-- One value per indicator, area and year: the marts pivot with max(), which would hide duplicates.
select indicator_id, area_code, year, count(*) as n
from {{ ref('stg_bbga__kerncijfers') }}
group by indicator_id, area_code, year
having count(*) > 1
