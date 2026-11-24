// A made-up channel used when the site runs without a YouTube API key
// (local preview), so every part of the page can be seen and tested.

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

export function demoChannel() {
  const v = (id, title, views, days, durationSec, description = '') =>
    ({ id, title, views, publishedAt: daysAgo(days), durationSec, description, thumbnail: '' });
  const videos = [
    v('d1', 'Funny cooking fails compilation #shorts', 182000, 20, 45),
    v('d2', '5-minute masala omelette | quick breakfast', 64000, 6, 312, 'My mum’s recipe, the way we make it at home.'),
    v('d3', 'Best moments from cooking shows 2026', 51000, 40, 610),
    v('d4', 'Street food TikTok viral clips', 33000, 55, 58),
    v('d5', 'Easy dal tadka for beginners | home cooking', 21000, 13, 540),
    v('d6', 'Paneer butter masala at home | restaurant style', 18500, 27, 720),
    v('d7', 'Chai recipe for winter | home cooking', 9100, 3, 400),
    v('d8', 'Lunch box ideas for kids | quick recipes', 7400, 34, 480),
    v('d9', 'Rava upma in 10 minutes | quick breakfast', 5100, 48, 380),
    v('d10', 'Kitchen tour of my small kitchen', 3900, 70, 900),
  ];
  return {
    id: 'UCdemo0000000000000000000',
    title: 'Riya’s Home Kitchen (demo)',
    handle: '@riyashomekitchen-demo',
    description: 'Simple home cooking recipes every week. Business: hello@example.com',
    thumbnail: '',
    country: 'IN',
    subscribers: 1240,
    hiddenSubscribers: false,
    videoCount: videos.length,
    videos,
    demo: true,
  };
}
