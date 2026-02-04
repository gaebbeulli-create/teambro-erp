const CACHE_NAME = 'teambro-unified-v2.02';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/apps/hq/index.html',
    '/apps/operations/index.html'
];

// 설치
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// 활성화 - 이전 캐시 삭제
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names => Promise.all(
            names.map(name => {
                if (name !== CACHE_NAME) {
                    console.log('Deleting old cache:', name);
                    return caches.delete(name);
                }
            })
        )).then(() => self.clients.claim())
    );
});

// Fetch 처리
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Supabase API - 캐시 관여 없이 네트워크 직통
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // 외부 CDN (Tailwind, Chart.js 등) - 네트워크 우선, 실패시 무시
    if (!url.hostname.includes(self.location.hostname)) {
        event.respondWith(
            fetch(event.request).catch(() => new Response('', { status: 499 }))
        );
        return;
    }
    
    // SPA 네비게이션 - 서브앱별 Fallback 지원
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // 요청 경로에 맞는 캐시 먼저 시도
                    const pathname = url.pathname;
                    if (pathname.startsWith('/apps/hq/')) {
                        return caches.match('/apps/hq/index.html');
                    } else if (pathname.startsWith('/apps/operations/')) {
                        return caches.match('/apps/operations/index.html');
                    }
                    // 기본 fallback
                    return caches.match('/index.html');
                })
        );
        return;
    }
    
    // 일반 요청 - Network First, Cache Fallback
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // 같은 도메인 + GET + 성공 응답만 캐시
                if (
                    response.status === 200 &&
                    event.request.method === 'GET'
                ) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => 
                caches.match(event.request)
                    .then(r => r || caches.match('/index.html'))
            )
    );
});
