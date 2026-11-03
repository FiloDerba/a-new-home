select
    cast(identificatie as varchar) as ggw_gebied_id,
    cast(code as varchar) as gebied_code,
    cast(naam as varchar) as name,
    eindGeldigheid is null as is_current,
    cast(geometry as varchar) as geometry
from {{ source('amsterdam', 'ggw_gebieden') }}
