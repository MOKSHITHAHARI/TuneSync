function getYouTubeSongs(forcedType = 'mix') {
  const url = window.location.href;
  const songs = [];

  // Autodetect content type if not specified
  let contentType = forcedType;
  // Get songs based on content type
  // YouTube Mix extraction
  if (window.location.hostname === 'music.youtube.com') {
    // YouTube Music
    const autoplayItems = Array.from(
      document.querySelectorAll('ytmusic-player-queue-item')
    );
    autoplayItems.forEach((item) => {
      const titleElement = item.querySelector('.song-title');
      if (titleElement) {
        songs.push(cleanupSongTitle(titleElement.textContent.trim()));
      }
    });
  } else {
    // Regular YouTube
    // Current playing video
    const currentVideoTitle = document.querySelector(
      '.ytd-watch-metadata #title h1'
    );
    if (currentVideoTitle) {
      songs.push(cleanupSongTitle(currentVideoTitle.textContent.trim()));
    }

    // Videos in the mix/autoplay queue
    const mixItems = document.querySelectorAll(
      'style-scope ytd-playlist-panel-renderer'
    );
    mixItems.forEach((item) => {
      const titleElement = item.querySelector('#video-title');
      if (titleElement) {
        songs.push(cleanupSongTitle(titleElement.textContent.trim()));
      }
    });

    // Alternative selector for mix items
    if (songs.length <= 1) {
      const altMixItems = document.querySelectorAll(
        'ytd-playlist-panel-video-renderer'
      );
      altMixItems.forEach((item) => {
        const titleElement = item.querySelector('#video-title');
        if (titleElement) {
          songs.push(cleanupSongTitle(titleElement.textContent.trim()));
        }
      });
    }
  }

  // Remove duplicates
  const uniqueSongs = [...new Set(songs)];

  return uniqueSongs;
}

function cleanupSongTitle(title) {
  // Remove common YouTube-specific parts from titles
  let cleanTitle = title
    .replace(/\(Official Video\)/gi, '')
    .replace(/\[Official Video\]/gi, '')
    .replace(/\(Official Music Video\)/gi, '')
    .replace(/\(Official Audio\)/gi, '')
    .replace(/\(Audio\)/gi, '')
    .replace(/\(Lyrics\)/gi, '')
    .replace(/\[Lyrics\]/gi, '')
    .replace(/\(Lyric Video\)/gi, '')
    .replace(/\(HD\)/gi, '')
    .replace(/\(HQ\)/gi, '')
    .replace(/\d{4} Remaster/gi, '')
    .replace(/\bft\.|\bfeat\./gi, '') // Common featuring identifiers
    .replace(/\s+/g, ' ') // Remove extra spaces
    .trim();

  return cleanTitle;
}

// Artist detection for better Spotify matching
function extractArtistAndTitle(fullTitle) {
  // Common patterns: "Artist - Title", "Artist: Title", "Artist "Title""
  const patterns = [
    /^(.*?)\s-\s(.*)$/, // Artist - Title
    /^(.*?):\s(.*)$/, // Artist: Title
    /^(.*?)\s"(.*)"$/, // Artist "Title"
  ];

  for (const pattern of patterns) {
    const match = fullTitle.match(pattern);
    if (match) {
      return {
        artist: match[1].trim(),
        title: match[2].trim(),
      };
    }
  }

  // No pattern matched, return the full title as-is
  return {
    artist: '',
    title: fullTitle,
  };
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'getYouTubeSongs') {
    const songs = getYouTubeSongs(request.type);
    sendResponse({ songs: songs });
  }
  return true;
});
