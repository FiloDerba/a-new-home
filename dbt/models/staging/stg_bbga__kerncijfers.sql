select
    cast(indicatorDefinitieId as varchar) as indicator_id,
    cast(gebiedcode15 as varchar) as area_code,
    cast(jaar as integer) as year,
    cast(waarde as double) as value -- null where the city suppresses or has no figure
from {{ source('amsterdam', 'kerncijfers') }}
