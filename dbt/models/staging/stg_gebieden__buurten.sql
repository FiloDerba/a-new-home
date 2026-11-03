select
    cast(code as varchar) as buurt_code,
    cast(cbsCode as varchar) as cbs_code,
    cast(naam as varchar) as name,
    cast(ligtInGgwgebiedId as varchar) as ggw_gebied_id,
    eindGeldigheid is null as is_current,
    cast(geometry as varchar) as geometry
from {{ source('amsterdam', 'buurten') }}
