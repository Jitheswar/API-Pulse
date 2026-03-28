import ipaddress
import socket
from urllib.parse import urlparse


def is_private_url(url: str) -> bool:
    """Block SSRF: reject URLs that resolve to private/internal IP addresses."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return True
        if hostname in ("localhost", "metadata.google.internal"):
            return True
        addr_info = socket.getaddrinfo(
            hostname, parsed.port or 443, proto=socket.IPPROTO_TCP
        )
        for family, _, _, _, sockaddr in addr_info:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return True
    except (socket.gaierror, ValueError, OSError):
        return True
    return False
