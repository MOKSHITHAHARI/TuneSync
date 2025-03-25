document.addEventListener('DOMContentLoaded', function () {
  const loginButton = document.getElementById('login-button');
  const convertButton = document.getElementById('convert-button');
  const authSection = document.getElementById('auth-section');
  const convertSection = document.getElementById('convert-section');
  const statusDiv = document.getElementById('status');

  // Check if user is already authenticated
  chrome.storage.local.get(['spotifyToken', 'tokenExpiry'], function (result) {
    if (result.spotifyToken && result.tokenExpiry > Date.now()) {
      authSection.classList.add('hidden');
      convertSection.classList.remove('hidden');
    }
  });

  // Handle login
  loginButton.addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: 'authenticate' }, function (response) {
      if (response && response.success) {
        authSection.classList.add('hidden');
        convertSection.classList.remove('hidden');
      } else {
        statusDiv.textContent = 'Authentication failed. Please try again.';
      }
    });
  });

  // Handle conversion
  convertButton.addEventListener('click', function () {
    const playlistName =
      document.getElementById('playlist-name').value || 'YouTube Playlist';
    const playlistType = 'mix';

    statusDiv.textContent = 'Scanning YouTube content...';

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: 'getYouTubeSongs',
          type: playlistType,
        },
        function (response) {
          if (response && response.songs && response.songs.length > 0) {
            statusDiv.textContent = `Found ${response.songs.length} songs. Creating Spotify playlist...`;

            chrome.runtime.sendMessage(
              {
                action: 'createSpotifyPlaylist',
                songs: response.songs,
                playlistName: playlistName,
              },
              function (result) {
                if (result.success) {
                  statusDiv.innerHTML = `Playlist created successfully!<br>
                Added ${result.addedSongs} of ${response.songs.length} songs.<br>
                <a href="${result.playlistUrl}" target="_blank">Open in Spotify</a>`;
                } else {
                  statusDiv.textContent =
                    'Failed to create playlist: ' + result.error;
                }
              }
            );
          } else {
            statusDiv.textContent = 'No songs found or failed to scan content.';
          }
        }
      );
    });
  });
});
