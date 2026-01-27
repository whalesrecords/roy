#!/usr/bin/env python3
"""
Test script to debug SubmitHub parser URL extraction.
"""

import re

def extract_info_from_campaign_url(url: str):
    """Extract artist name and song title from SubmitHub campaign URL."""
    if not url:
        return None, None

    print(f"Testing URL: {url}")

    # Test pattern 1: /by/{artist}/{song}
    pattern1 = r'/by/([^/]+)/([^/?]+)'
    match = re.search(pattern1, url)
    if match:
        artist_slug = match.group(1)
        song_slug = match.group(2)
        artist_name = artist_slug.replace('-', ' ').replace('_', ' ').title()
        song_title = song_slug.replace('-', ' ').replace('_', ' ').title()
        print(f"  Pattern 1 matched!")
        print(f"  Artist: {artist_name}")
        print(f"  Song: {song_title}")
        return artist_name, song_title

    # Test pattern 2: /{artist}/{song}
    pattern2 = r'/([^/]+)/([^/?]+)$'
    match = re.search(pattern2, url)
    if match:
        artist_slug = match.group(1)
        song_slug = match.group(2)
        artist_name = artist_slug.replace('-', ' ').replace('_', ' ').title()
        song_title = song_slug.replace('-', ' ').replace('_', ' ').title()
        print(f"  Pattern 2 matched!")
        print(f"  Artist: {artist_name}")
        print(f"  Song: {song_title}")
        return artist_name, song_title

    print("  No pattern matched!")
    return None, None


if __name__ == "__main__":
    # Test avec quelques exemples
    test_urls = [
        "https://www.submithub.com/by/artist-name/song-title",
        "https://www.submithub.com/artist-name/song-title",
        "https://submithub.com/by/the-artist/the-song",
        "https://submithub.com/campaigns/123456",
    ]

    print("Testing SubmitHub URL patterns:\n")
    for url in test_urls:
        extract_info_from_campaign_url(url)
        print()

    print("\n" + "="*60)
    print("Paste your actual Campaign URL here and press Enter:")
    print("="*60)

    try:
        user_url = input("> ")
        if user_url.strip():
            print()
            extract_info_from_campaign_url(user_url.strip())
    except (EOFError, KeyboardInterrupt):
        print("\nExiting...")
