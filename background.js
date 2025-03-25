// Handle Spotify Authentication and API calls
let redirectUri = chrome.identity.getRedirectURL('oauth2');
const clientId = process.env.SPOTIFY_CLIENT_ID;

const authUrl =
  'https://accounts.spotify.com/authorize?' +
  'client_id=' +
  clientId +
  '&response_type=token' +
  '&redirect_uri=' +
  encodeURIComponent(redirectUri) +
  '&scope=playlist-modify-public playlist-modify-private user-read-private';

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'authenticate') {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      function (redirectURL) {
        if (chrome.runtime.lastError || !redirectURL) {
          sendResponse({ success: false, error: chrome.runtime.lastError });
          return;
        }

        const url = new URL(redirectURL);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const expiresIn = params.get('expires_in');

        if (accessToken) {
          const expiryTime = Date.now() + parseInt(expiresIn) * 1000;
          chrome.storage.local.set(
            {
              spotifyToken: accessToken,
              tokenExpiry: expiryTime,
            },
            function () {
              sendResponse({ success: true });
            }
          );
        } else {
          sendResponse({ success: false, error: 'No access token received' });
        }
      }
    );
    return true;
  }

  if (request.action === 'createSpotifyPlaylist') {
    createSpotifyPlaylist(request.songs, request.playlistName)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function createSpotifyPlaylist(songs, name) {
  try {
    const tokenData = await new Promise((resolve) => {
      chrome.storage.local.get(['spotifyToken', 'tokenExpiry'], resolve);
    });

    if (!tokenData.spotifyToken || tokenData.tokenExpiry <= Date.now()) {
      return { success: false, error: 'Token expired. Please login again.' };
    }

    const token = tokenData.spotifyToken;

    // Get user ID
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: 'Bearer ' + token,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user profile');
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    // Create a new playlist
    const playlistResponse = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          description: 'Created from YouTube playlist/mix',
          public: false,
        }),
      }
    );

    if (!playlistResponse.ok) {
      throw new Error('Failed to create playlist');
    }

    const playlistData = await playlistResponse.json();
    const playlistId = playlistData.id;
    const playlistUrl = playlistData.external_urls.spotify;

    // Search for and add songs to the playlist
    let addedSongs = 0;
    let trackUris = [];

    for (const song of songs) {
      try {
        // parse artist and title for better search
        const parsed = extractArtistAndTitle(song);
        const searchQuery = parsed.artist
          ? `track:${parsed.title} artist:${parsed.artist}`
          : song;

        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            searchQuery
          )}&type=track&limit=1`,
          {
            headers: {
              Authorization: 'Bearer ' + token,
            },
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.tracks.items.length > 0) {
            trackUris.push(searchData.tracks.items[0].uri);
            addedSongs++;
          } else {
            // If no results with artist parsing, try a simpler search
            if (parsed.artist) {
              const fallbackResponse = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(
                  song
                )}&type=track&limit=1`,
                {
                  headers: {
                    Authorization: 'Bearer ' + token,
                  },
                }
              );

              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.tracks.items.length > 0) {
                  trackUris.push(fallbackData.tracks.items[0].uri);
                  addedSongs++;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error searching for song "${song}":`, error);
      }
    }

    // Add tracks to playlist (in batches of 100 as per Spotify API limits)
    for (let i = 0; i < trackUris.length; i += 100) {
      const batch = trackUris.slice(i, i + 100);

      await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: batch,
        }),
      });
    }

    return {
      success: true,
      addedSongs: addedSongs,
      playlistUrl: playlistUrl,
    };
  } catch (error) {
    console.error('Error creating Spotify playlist:', error);
    return { success: false, error: error.message };
  }
}

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
