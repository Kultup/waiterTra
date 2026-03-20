import React from 'react';
import API_URL from '../api';

const VideoPlayer = ({ url }) => {
    if (!url) return null;

    const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
    if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1].split('&')[0];
        return (
            <iframe width="100%" height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player" frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen />
        );
    }

    const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
        return (
            <iframe src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                width="100%" height="100%" frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        );
    }

    const videoSrc = url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
    return (
        <video controls style={{ width: '100%', height: '100%' }}>
            <source src={videoSrc} />
        </video>
    );
};

export default VideoPlayer;
