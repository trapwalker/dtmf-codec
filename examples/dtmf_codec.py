

def latlon2dtmf(ll: tuple[float, float] | tuple[str, str], checksum_length: int = 3) -> str:
    if isinstance(ll, tuple):
        lat, lon = map(str, ll)

    encoded_point = f"{lat}#{lon}".replace('.', '*').replace('-', 'D')
    