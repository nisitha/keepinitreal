<?php
session_start();

$password = 'admin123'; // Admin credentials
$videosFile = __DIR__ . '/videos.json';
$merchFile = __DIR__ . '/merch.json';
$merchUploadDir = __DIR__ . '/uploads/merch/';

// Ensure data files exist
if (!file_exists($videosFile)) file_put_contents($videosFile, '[]');
if (!file_exists($merchFile)) file_put_contents($merchFile, '[]');

$videos = json_decode(file_get_contents($videosFile), true) ?: [];
$merch = json_decode(file_get_contents($merchFile), true) ?: [];

// Helper: YouTube Video ID & Title extractor
function extractYouTubeInfo($url) {
    $videoId = '';
    if (preg_match('/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i', $url, $match)) {
        $videoId = $match[1];
    }
    
    $title = 'New Episode';
    $oembed_target_url = $videoId ? "https://www.youtube.com/watch?v={$videoId}" : $url;
    $oembed_url = 'https://www.youtube.com/oembed?url=' . urlencode($oembed_target_url) . '&format=json';
    
    $options = [
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n",
            'timeout' => 4
        ]
    ];
    $ctx = stream_context_create($options);
    $response = @file_get_contents($oembed_url, false, $ctx);
    if ($response) {
        $data = json_decode($response, true);
        if (is_array($data) && !empty($data['title'])) {
            $title = $data['title'];
        }
    }
    
    return [
        'id' => $videoId ?: uniqid(),
        'title' => $title,
        'url' => $videoId ? "https://www.youtube.com/embed/{$videoId}" : $url,
        'embedUrl' => $videoId ? "https://www.youtube.com/embed/{$videoId}" : $url,
        'thumbnail' => $videoId ? "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg" : ''
    ];
}

// Helper: Price Sanitizer (clean for PayPal)
function sanitizePrice($price) {
    $clean = preg_replace('/[^0-9.]/', '', (string)$price);
    if (is_numeric($clean)) {
        return number_format((float)$clean, 2, '.', '');
    }
    return '0.00';
}

// ============================================================
// 1. JSON REST API HANDLER (For Next.js /admin and AJAX)
// ============================================================
if (isset($_GET['api']) || isset($_GET['action']) || (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false)) {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    $rawInput = file_get_contents('php://input');
    $inputData = json_decode($rawInput, true) ?: [];
    $action = $_GET['action'] ?? $inputData['action'] ?? '';

    // Auth check
    $isAuthed = (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) ||
                (isset($_SERVER['HTTP_AUTHORIZATION']) && $_SERVER['HTTP_AUTHORIZATION'] === 'Bearer ' . $password) ||
                (isset($inputData['password']) && $inputData['password'] === $password);

    if ($action === 'login') {
        $pwd = $inputData['password'] ?? $_POST['password'] ?? '';
        if ($pwd === $password) {
            $_SESSION['logged_in'] = true;
            echo json_encode(['success' => true, 'message' => 'Logged in successfully']);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Incorrect password']);
        }
        exit;
    }

    if ($action === 'check_auth') {
        echo json_encode(['authenticated' => $isAuthed]);
        exit;
    }

    if ($action === 'logout') {
        session_destroy();
        echo json_encode(['success' => true]);
        exit;
    }

    // Public read action
    if ($action === 'get_data') {
        echo json_encode([
            'success' => true,
            'videos' => $videos,
            'merch' => $merch
        ]);
        exit;
    }

    // Guard all write actions with auth check
    if (!$isAuthed) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized. Please login with admin credentials.']);
        exit;
    }

    // Add Video
    if ($action === 'add_video') {
        $url = trim($inputData['url'] ?? $_POST['url'] ?? '');
        $customTitle = trim($inputData['title'] ?? $_POST['title'] ?? '');
        if (!empty($url)) {
            $info = extractYouTubeInfo($url);
            if (!empty($customTitle)) {
                $info['title'] = $customTitle;
            }
            array_unshift($videos, $info);
            file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
            echo json_encode(['success' => true, 'videos' => $videos, 'added' => $info]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Video URL is required']);
        }
        exit;
    }

    // Save full videos list / reorder
    if ($action === 'save_videos') {
        $newVideos = $inputData['videos'] ?? null;
        if (is_array($newVideos)) {
            $videos = $newVideos;
            file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
            echo json_encode(['success' => true, 'videos' => $videos]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid videos array']);
        }
        exit;
    }

    // Delete Video
    if ($action === 'delete_video') {
        $id = $inputData['id'] ?? $_POST['id'] ?? '';
        $videos = array_values(array_filter($videos, function($v) use ($id) { return $v['id'] !== $id; }));
        file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'videos' => $videos]);
        exit;
    }

    // Reorder single video
    if ($action === 'reorder_video') {
        $id = $inputData['id'] ?? $_POST['id'] ?? '';
        $dir = $inputData['direction'] ?? $_POST['direction'] ?? '';
        $index = array_search($id, array_column($videos, 'id'));
        if ($index !== false) {
            if ($dir === 'up' && $index > 0) {
                $temp = $videos[$index - 1];
                $videos[$index - 1] = $videos[$index];
                $videos[$index] = $temp;
            } elseif ($dir === 'down' && $index < count($videos) - 1) {
                $temp = $videos[$index + 1];
                $videos[$index + 1] = $videos[$index];
                $videos[$index] = $temp;
            }
            file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
        }
        echo json_encode(['success' => true, 'videos' => $videos]);
        exit;
    }

    // Add Merch Item
    if ($action === 'add_merch') {
        $name = trim($_POST['name'] ?? $inputData['name'] ?? '');
        $rawPrice = $_POST['price'] ?? $inputData['price'] ?? '0';
        $price = sanitizePrice($rawPrice);
        $hasSizes = !empty($_POST['hasSizes']) || !empty($inputData['hasSizes']);
        $description = trim($_POST['description'] ?? $inputData['description'] ?? '');
        $businessEmail = trim($_POST['businessEmail'] ?? $inputData['businessEmail'] ?? 'gary@lisaslight.com');
        $imageUrl = trim($_POST['imageUrl'] ?? $inputData['imageUrl'] ?? '');

        // Handle uploaded file
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            if (!is_dir($merchUploadDir)) {
                mkdir($merchUploadDir, 0777, true);
            }
            $cleanName = preg_replace('/[^a-zA-Z0-9._-]/', '', basename($_FILES['image']['name']));
            $fileName = time() . '_' . $cleanName;
            $targetPath = $merchUploadDir . $fileName;
            if (move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
                $imageUrl = '/uploads/merch/' . $fileName;
            }
        }

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Product name is required']);
            exit;
        }

        $newItem = [
            'id' => uniqid(),
            'name' => $name,
            'description' => $description ?: "Official Keepin' It Real Merchandise. Shipping included.",
            'price' => (float)$price,
            'imageUrl' => $imageUrl ?: '/merch-polo.jpg',
            'hasSizes' => $hasSizes,
            'businessEmail' => $businessEmail,
            'createdAt' => date('c')
        ];

        array_unshift($merch, $newItem);
        file_put_contents($merchFile, json_encode($merch, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'merch' => $merch, 'added' => $newItem]);
        exit;
    }

    // Delete Merch Item
    if ($action === 'delete_merch') {
        $id = $inputData['id'] ?? $_POST['id'] ?? '';
        $itemToDelete = null;
        foreach ($merch as $item) {
            if ($item['id'] === $id) { $itemToDelete = $item; break; }
        }
        if ($itemToDelete) {
            $filePath = __DIR__ . '/' . ltrim($itemToDelete['imageUrl'], '/');
            if (file_exists($filePath) && strpos($filePath, 'uploads/merch/') !== false) {
                @unlink($filePath);
            }
            $merch = array_values(array_filter($merch, function($m) use ($id) { return $m['id'] !== $id; }));
            file_put_contents($merchFile, json_encode($merch, JSON_PRETTY_PRINT));
        }
        echo json_encode(['success' => true, 'merch' => $merch]);
        exit;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Unknown action']);
    exit;
}

// ============================================================
// 2. STANDARD POST SUBMISSION HANDLERS (For Traditional PHP Forms)
// ============================================================
if (isset($_POST['login'])) {
    if ($_POST['password'] === $password) {
        $_SESSION['logged_in'] = true;
    } else {
        $error = "Incorrect password.";
    }
}

if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: admin.php");
    exit;
}

// Check traditional auth
$isLoggedIn = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;

if ($isLoggedIn) {
    // Add video
    if (isset($_POST['add_video'])) {
        $url = trim($_POST['url']);
        if (!empty($url)) {
            $info = extractYouTubeInfo($url);
            array_unshift($videos, $info);
            file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
            header("Location: admin.php?tab=videos&saved=1");
            exit;
        }
    }

    // Delete video
    if (isset($_POST['delete_video'])) {
        $id = $_POST['id'];
        $videos = array_values(array_filter($videos, function($v) use ($id) { return $v['id'] !== $id; }));
        file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
        header("Location: admin.php?tab=videos&deleted=1");
        exit;
    }

    // Move video up/down
    if (isset($_POST['move_up']) || isset($_POST['move_down'])) {
        $id = $_POST['id'];
        $index = array_search($id, array_column($videos, 'id'));
        if ($index !== false) {
            if (isset($_POST['move_up']) && $index > 0) {
                $temp = $videos[$index - 1];
                $videos[$index - 1] = $videos[$index];
                $videos[$index] = $temp;
            } elseif (isset($_POST['move_down']) && $index < count($videos) - 1) {
                $temp = $videos[$index + 1];
                $videos[$index + 1] = $videos[$index];
                $videos[$index] = $temp;
            }
            file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
        }
        header("Location: admin.php?tab=videos");
        exit;
    }

    // Add merch
    if (isset($_POST['add_merch'])) {
        $name = trim($_POST['name']);
        $rawPrice = trim($_POST['price']);
        $price = (float)sanitizePrice($rawPrice);
        $hasSizes = isset($_POST['hasSizes']);
        $imageUrl = '/merch-polo.jpg';

        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            if (!is_dir($merchUploadDir)) {
                mkdir($merchUploadDir, 0777, true);
            }
            $cleanName = preg_replace('/[^a-zA-Z0-9._-]/', '', basename($_FILES['image']['name']));
            $fileName = time() . '_' . $cleanName;
            $targetPath = $merchUploadDir . $fileName;
            if (move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
                $imageUrl = '/uploads/merch/' . $fileName;
            }
        }

        if (!empty($name)) {
            array_unshift($merch, [
                'id' => uniqid(),
                'name' => $name,
                'description' => "Official Keepin' It Real Merchandise. Shipping included.",
                'price' => $price,
                'imageUrl' => $imageUrl,
                'hasSizes' => $hasSizes,
                'businessEmail' => 'gary@lisaslight.com',
                'createdAt' => date('c')
            ]);
            file_put_contents($merchFile, json_encode($merch, JSON_PRETTY_PRINT));
        }
        header("Location: admin.php?tab=merch&saved=1");
        exit;
    }

    // Delete merch
    if (isset($_POST['delete_merch'])) {
        $id = $_POST['id'];
        $itemToDelete = null;
        foreach ($merch as $item) {
            if ($item['id'] === $id) { $itemToDelete = $item; break; }
        }
        if ($itemToDelete) {
            $filePath = __DIR__ . '/' . ltrim($itemToDelete['imageUrl'], '/');
            if (file_exists($filePath) && strpos($filePath, 'uploads/merch/') !== false) {
                @unlink($filePath);
            }
            $merch = array_values(array_filter($merch, function($m) use ($id) { return $m['id'] !== $id; }));
            file_put_contents($merchFile, json_encode($merch, JSON_PRETTY_PRINT));
        }
        header("Location: admin.php?tab=merch&deleted=1");
        exit;
    }
}

$activeTab = $_GET['tab'] ?? 'videos';
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Keepin' It Real - Admin Control Center</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col">

<?php if (!$isLoggedIn): ?>
<!-- LOGIN SCREEN -->
<div class="flex-1 flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/20 text-slate-950 font-black text-2xl">
            K
        </div>
        <h2 class="text-2xl font-extrabold text-white">Admin Login</h2>
        <p class="text-sm text-slate-400 mt-1 mb-6">Keepin' It Real Content & Community</p>

        <?php if (isset($error)): ?>
            <div class="mb-5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-sm font-medium">
                <?= htmlspecialchars($error) ?>
            </div>
        <?php endif; ?>

        <form method="POST" class="space-y-4 text-left">
            <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Password</label>
                <input 
                    type="password" 
                    name="password" 
                    placeholder="Enter admin password" 
                    required 
                    autofocus
                    class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                >
            </div>
            <button 
                type="submit" 
                name="login"
                class="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
                Enter Admin Dashboard
            </button>
        </form>
        <div class="mt-6 pt-6 border-t border-slate-800 text-xs text-slate-500">
            <a href="/" class="hover:text-teal-400 transition-colors">&larr; Return to Public Website</a>
        </div>
    </div>
</div>
</body>
</html>
<?php exit; endif; ?>

<!-- AUTHENTICATED MODERN DASHBOARD -->
<header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-slate-950 font-black text-xl">
                K
            </div>
            <div>
                <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    Keepin&apos; It Real
                    <span class="text-xs uppercase px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-semibold tracking-wider">
                        Admin
                    </span>
                </h1>
                <p class="text-xs text-slate-400">Videos, Merch & Community Moderation</p>
            </div>
        </div>

        <div class="flex items-center gap-3">
            <a href="/" target="_blank" class="text-xs text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5">
                <span>View Public Site</span>
                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
            </a>
            <a href="admin.php?logout=1" class="text-xs font-semibold text-rose-400 hover:text-white px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-600 border border-rose-800/40 transition-all">
                Logout
            </a>
        </div>
    </div>
</header>

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
    <!-- NAVIGATION TABS -->
    <div class="flex flex-wrap items-center border-b border-slate-800 gap-2 mb-8">
        <a href="?tab=videos" class="flex items-center gap-2 pb-3.5 px-4 font-semibold text-sm transition-all border-b-2 <?= $activeTab === 'videos' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-slate-200' ?>">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Videos Manager
            <span class="ml-1 text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/30">
                <?= count($videos) ?>
            </span>
        </a>

        <a href="?tab=merch" class="flex items-center gap-2 pb-3.5 px-4 font-semibold text-sm transition-all border-b-2 <?= $activeTab === 'merch' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-slate-200' ?>">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Merch Manager
            <span class="ml-1 text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/30">
                <?= count($merch) ?>
            </span>
        </a>

        <a href="?tab=comments" class="flex items-center gap-2 pb-3.5 px-4 font-semibold text-sm transition-all border-b-2 <?= $activeTab === 'comments' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-slate-200' ?>">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Comments Moderation
            <span id="comment-count-badge" class="ml-1 text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/30">
                Live
            </span>
        </a>

        <a href="?tab=analytics" class="flex items-center gap-2 pb-3.5 px-4 font-semibold text-sm transition-all border-b-2 <?= $activeTab === 'analytics' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-slate-200' ?>">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Traffic Analytics
            <span id="analytics-count-badge" class="ml-1 text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                Live
            </span>
        </a>
    </div>

    <!-- TAB 1: VIDEOS MANAGER -->
    <?php if ($activeTab === 'videos'): ?>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Add Video Form -->
        <div class="lg:col-span-1">
            <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl sticky top-28">
                <h3 class="text-lg font-bold text-white mb-1">Add YouTube Video</h3>
                <p class="text-xs text-slate-400 mb-6">Enter any YouTube link; titles and thumbnails are extracted automatically.</p>

                <form method="POST" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">YouTube URL</label>
                        <input 
                            type="text" 
                            name="url" 
                            placeholder="https://www.youtube.com/watch?v=... or embed" 
                            required 
                            class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                        >
                    </div>
                    <button 
                        type="submit" 
                        name="add_video" 
                        class="w-full py-3 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Video
                    </button>
                </form>
            </div>
        </div>

        <!-- Video List with Thumbnails & Reordering -->
        <div class="lg:col-span-2">
            <div class="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                    <div>
                        <h3 class="text-lg font-bold text-white">Channel Videos</h3>
                        <p class="text-xs text-slate-400">Order reflects top-to-bottom appearance on the Videos page</p>
                    </div>
                    <span class="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full"><?= count($videos) ?> total</span>
                </div>

                <div class="space-y-3">
                    <?php foreach ($videos as $idx => $v): 
                        $vidId = $v['id'] ?? '';
                        if (empty($vidId) && !empty($v['url'])) {
                            if (preg_match('/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/', $v['url'], $m)) {
                                $vidId = $m[1];
                            }
                        }
                        $thumb = $v['thumbnail'] ?? ($vidId ? "https://img.youtube.com/vi/{$vidId}/hqdefault.jpg" : '');
                    ?>
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all">
                        <div class="flex items-center gap-3.5 min-w-0">
                            <!-- Thumbnail -->
                            <div class="w-20 h-14 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 relative border border-slate-700">
                                <?php if ($thumb): ?>
                                    <img src="<?= htmlspecialchars($thumb) ?>" alt="thumb" class="w-full h-full object-cover">
                                <?php else: ?>
                                    <div class="w-full h-full flex items-center justify-center text-slate-500 text-xs">No img</div>
                                <?php endif; ?>
                            </div>
                            <!-- Title & URL -->
                            <div class="min-w-0">
                                <h4 class="text-sm font-semibold text-white truncate max-w-sm" title="<?= htmlspecialchars($v['title'] ?? 'Video') ?>">
                                    <?= htmlspecialchars($v['title'] ?? 'Keepin\' It Real Episode') ?>
                                </h4>
                                <p class="text-xs text-slate-500 font-mono truncate max-w-xs mt-0.5">
                                    <?= htmlspecialchars($v['url'] ?? '') ?>
                                </p>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-center gap-1.5 self-end sm:self-center">
                            <!-- Move Up -->
                            <form method="POST" class="inline m-0">
                                <input type="hidden" name="id" value="<?= htmlspecialchars($v['id']) ?>">
                                <button 
                                    type="submit" 
                                    name="move_up" 
                                    <?= $idx === 0 ? 'disabled' : '' ?>
                                    class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Move Up"
                                >
                                    &uarr;
                                </button>
                            </form>
                            <!-- Move Down -->
                            <form method="POST" class="inline m-0">
                                <input type="hidden" name="id" value="<?= htmlspecialchars($v['id']) ?>">
                                <button 
                                    type="submit" 
                                    name="move_down" 
                                    <?= $idx === count($videos) - 1 ? 'disabled' : '' ?>
                                    class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Move Down"
                                >
                                    &darr;
                                </button>
                            </form>
                            <!-- Delete -->
                            <form method="POST" class="inline m-0" onsubmit="return confirm('Are you sure you want to delete this video?');">
                                <input type="hidden" name="id" value="<?= htmlspecialchars($v['id']) ?>">
                                <button 
                                    type="submit" 
                                    name="delete_video" 
                                    class="px-3 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-800/40 text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Delete
                                </button>
                            </form>
                        </div>
                    </div>
                    <?php endforeach; ?>

                    <?php if (empty($videos)): ?>
                        <div class="text-center py-12 text-slate-500">No videos found. Add your first YouTube video above.</div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <!-- TAB 2: MERCH MANAGER -->
    <?php if ($activeTab === 'merch'): ?>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Add Merch Item -->
        <div class="lg:col-span-1">
            <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl sticky top-28">
                <h3 class="text-lg font-bold text-white mb-1">Add Merch Item</h3>
                <p class="text-xs text-slate-400 mb-6">Price is automatically sanitized for PayPal compatibility.</p>

                <form method="POST" enctype="multipart/form-data" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Item Name</label>
                        <input 
                            type="text" 
                            name="name" 
                            placeholder="e.g. Signature Cycling Jersey" 
                            required 
                            class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                        >
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Price (USD)</label>
                        <input 
                            type="text" 
                            name="price" 
                            placeholder="e.g. 25.00" 
                            required 
                            class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                        >
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Product Image</label>
                        <input 
                            type="file" 
                            name="image" 
                            accept="image/*" 
                            required 
                            class="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-teal-400 hover:file:bg-slate-700 cursor-pointer"
                        >
                    </div>

                    <div class="flex items-center gap-3 pt-2">
                        <input type="checkbox" name="hasSizes" id="hasSizes" value="1" class="w-4 h-4 rounded text-teal-500 bg-slate-950 border-slate-800 focus:ring-teal-500">
                        <label for="hasSizes" class="text-xs text-slate-300 select-none">Requires Size Selection (S, M, L, XL, XXL)</label>
                    </div>

                    <button 
                        type="submit" 
                        name="add_merch" 
                        class="w-full mt-2 py-3 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Product
                    </button>
                </form>
            </div>
        </div>

        <!-- Merch Catalog -->
        <div class="lg:col-span-2">
            <div class="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                    <div>
                        <h3 class="text-lg font-bold text-white">Current Merchandise</h3>
                        <p class="text-xs text-slate-400">Items currently active on the official merchandise store</p>
                    </div>
                    <span class="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full"><?= count($merch) ?> items</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <?php foreach ($merch as $item): ?>
                    <div class="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
                        <div>
                            <div class="w-full h-44 rounded-xl overflow-hidden bg-slate-900 mb-3 relative border border-slate-800">
                                <img src="<?= htmlspecialchars($item['imageUrl']) ?>" alt="merch" class="w-full h-full object-cover">
                                <?php if (!empty($item['hasSizes'])): ?>
                                    <span class="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider bg-slate-900/90 text-teal-300 px-2 py-1 rounded-md border border-teal-500/30">
                                        S - XXL
                                    </span>
                                <?php endif; ?>
                            </div>
                            <h4 class="font-bold text-white text-sm leading-snug"><?= htmlspecialchars($item['name']) ?></h4>
                            <div class="text-emerald-400 font-extrabold text-base mt-1">$<?= number_format((float)sanitizePrice($item['price']), 2) ?></div>
                        </div>

                        <div class="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                            <span class="text-[11px] text-slate-500">PayPal Direct</span>
                            <form method="POST" class="m-0" onsubmit="return confirm('Delete this merch item?');">
                                <input type="hidden" name="id" value="<?= htmlspecialchars($item['id']) ?>">
                                <button type="submit" name="delete_merch" class="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-800/40 text-xs font-bold transition-colors cursor-pointer">
                                    Delete
                                </button>
                            </form>
                        </div>
                    </div>
                    <?php endforeach; ?>

                    <?php if (empty($merch)): ?>
                        <div class="col-span-2 text-center py-12 text-slate-500">No merchandise found.</div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <!-- TAB 3: COMMENTS MODERATION (Live Firebase Integration) -->
    <?php if ($activeTab === 'comments'): ?>
    <div id="comments-moderation-container">
        <div class="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    Comments Moderation
                    <span class="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Firebase Firestore
                    </span>
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">Real-time visitor comments. Deletions take effect immediately.</p>
            </div>
            <div id="comments-status" class="text-xs text-slate-400">Connecting...</div>
        </div>

        <div id="comments-list" class="space-y-3">
            <div class="text-center py-16 text-slate-500">Loading comments from Firestore...</div>
        </div>
    </div>

    <!-- Firebase JS SDK Integration -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getFirestore, collection, query, orderBy, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyAmm0JLX7uATj-Xtw6tHK0Gs8LLljk21XM",
            authDomain: "keepinitreal-ee191.firebaseapp.com",
            projectId: "keepinitreal-ee191",
            storageBucket: "keepinitreal-ee191.firebasestorage.app",
            messagingSenderId: "322946442988",
            appId: "1:322946442988:web:e4534233e401a6b941e7c9"
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        const listEl = document.getElementById("comments-list");
        const statusEl = document.getElementById("comments-status");
        const countBadge = document.getElementById("comment-count-badge");

        const q = query(collection(db, "comments"), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            const comments = [];
            snapshot.forEach((d) => {
                comments.push({ id: d.id, ...d.data() });
            });

            if (countBadge) countBadge.textContent = comments.length;
            if (statusEl) statusEl.textContent = `${comments.length} total comments`;

            if (comments.length === 0) {
                listEl.innerHTML = `<div class="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 text-slate-400">No comments found in database.</div>`;
                return;
            }

            listEl.innerHTML = comments.map(c => {
                const author = c.name || c.author || 'Anonymous';
                const text = c.text || c.content || '';
                const email = c.email || '';
                let dateStr = 'Recently';
                if (c.createdAt && typeof c.createdAt.toDate === 'function') {
                    dateStr = c.createdAt.toDate().toLocaleString();
                } else if (c.createdAt && c.createdAt.seconds) {
                    dateStr = new Date(c.createdAt.seconds * 1000).toLocaleString();
                }

                return `
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all" id="comment-${c.id}">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-bold text-sm text-teal-300">${escapeHtml(author)}</span>
                                ${email ? `<span class="text-xs text-slate-500">(${escapeHtml(email)})</span>` : ''}
                                <span class="text-xs text-slate-500 ml-auto sm:ml-2 font-mono">${dateStr}</span>
                            </div>
                            <p class="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(text)}</p>
                        </div>
                        <button 
                            onclick="window.deleteComment('${c.id}')"
                            class="px-3.5 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-800/40 text-xs font-bold transition-all cursor-pointer self-end sm:self-center"
                        >
                            Delete
                        </button>
                    </div>
                `;
            }).join("");
        }, (err) => {
            if (statusEl) statusEl.textContent = "Error loading comments";
            listEl.innerHTML = `<div class="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-sm">Failed to connect to Firestore: ${err.message}</div>`;
        });

        function escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        window.deleteComment = async function(id) {
            if (!confirm("Are you sure you want to delete this comment?")) return;
            try {
                const el = document.getElementById("comment-" + id);
                if (el) el.style.opacity = '0.3';
                await deleteDoc(doc(db, "comments", id));
            } catch (e) {
                alert("Failed to delete comment: " + e.message);
                const el = document.getElementById("comment-" + id);
                if (el) el.style.opacity = '1';
            }
        };
    </script>
    <!-- TAB 4: TRAFFIC ANALYTICS (Live Firebase Integration) -->
    <?php if ($activeTab === 'analytics'): ?>
    <div id="analytics-container" class="space-y-8">
        <div class="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    Privacy-Friendly Traffic Analytics
                    <span class="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-semibold flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                        Live Firestore Tracking
                    </span>
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">Session deduplicated visitor events with zero personal data storage (GDPR friendly).</p>
            </div>
            <div id="analytics-status" class="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                Connecting to site_analytics...
            </div>
        </div>

        <!-- Metric Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div class="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Total Page Views</span>
                <div id="stat-total" class="text-3xl font-black text-white">...</div>
                <p class="text-xs text-slate-500 mt-1">All recorded sessions</p>
            </div>

            <div class="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Last 7 Days</span>
                <div id="stat-7days" class="text-3xl font-black text-emerald-400">...</div>
                <p class="text-xs text-slate-500 mt-1">Recent 7-day velocity</p>
            </div>

            <div class="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Today's Views</span>
                <div id="stat-today" class="text-3xl font-black text-amber-400">...</div>
                <p class="text-xs text-slate-500 mt-1">Visits logged today</p>
            </div>

            <div class="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Device Split</span>
                <div id="stat-devices" class="text-2xl font-black text-teal-300">...</div>
                <div id="stat-device-bar" class="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden flex">
                    <div class="bg-teal-400 h-full" style="width: 50%"></div>
                    <div class="bg-indigo-500 h-full" style="width: 50%"></div>
                </div>
            </div>
        </div>

        <!-- Breakdown Grids -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl">
                <h4 class="text-lg font-bold text-white mb-1">Most Popular Pages</h4>
                <p class="text-xs text-slate-400 mb-4 pb-3 border-b border-slate-800">Ranked by traffic volume</p>
                <div id="popular-pages-list" class="space-y-3 text-xs">
                    <div class="py-8 text-center text-slate-500">Loading page analytics...</div>
                </div>
            </div>

            <div class="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl">
                <h4 class="text-lg font-bold text-white mb-1">Top Inbound Referrers</h4>
                <p class="text-xs text-slate-400 mb-4 pb-3 border-b border-slate-800">Where traffic originated</p>
                <div id="top-referrers-list" class="space-y-3 text-xs">
                    <div class="py-8 text-center text-slate-500">Loading referrer data...</div>
                </div>
            </div>
        </div>

        <!-- Recent Visitor Stream -->
        <div class="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl">
            <h4 class="text-lg font-bold text-white mb-1">Recent Visitor Stream</h4>
            <p class="text-xs text-slate-400 mb-4 pb-3 border-b border-slate-800">Live feed of visitor events</p>
            <div id="recent-stream-table" class="overflow-x-auto text-xs">
                <div class="py-8 text-center text-slate-500">Awaiting stream...</div>
            </div>
        </div>
    </div>

    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getFirestore, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyAmm0JLX7uATj-Xtw6tHK0Gs8LLljk21XM",
            authDomain: "keepinitreal-ee191.firebaseapp.com",
            projectId: "keepinitreal-ee191",
            storageBucket: "keepinitreal-ee191.firebasestorage.app",
            messagingSenderId: "322946442988",
            appId: "1:322946442988:web:e4534233e401a6b941e7c9"
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        const q = query(collection(db, "site_analytics"), orderBy("createdAt", "desc"), limit(2000));
        onSnapshot(q, (snapshot) => {
            const events = [];
            snapshot.forEach((d) => events.push({ id: d.id, ...d.data() }));

            const total = events.length;
            const now = Date.now();
            const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
            const todayStart = new Date().setHours(0, 0, 0, 0);

            let last7 = 0;
            let today = 0;
            let mobile = 0;
            const pages = {};
            const referrers = {};

            events.forEach(ev => {
                let t = 0;
                if (ev.createdAt && typeof ev.createdAt.toDate === 'function') t = ev.createdAt.toDate().getTime();
                else if (ev.createdAt && ev.createdAt.seconds) t = ev.createdAt.seconds * 1000;

                if (t >= sevenDaysAgo) last7++;
                if (t >= todayStart) today++;
                if (ev.device === 'Mobile') mobile++;

                const p = ev.path || '/';
                pages[p] = (pages[p] || 0) + 1;

                const r = ev.referrer || 'Direct';
                referrers[r] = (referrers[r] || 0) + 1;
            });

            const mobilePct = total > 0 ? Math.round((mobile / total) * 100) : 0;
            const desktopPct = total > 0 ? 100 - mobilePct : 0;

            document.getElementById("stat-total").textContent = total;
            document.getElementById("stat-7days").textContent = last7;
            document.getElementById("stat-today").textContent = today;
            document.getElementById("stat-devices").innerHTML = `${mobilePct}% <span class="text-xs text-slate-500">Mob</span> / ${desktopPct}% <span class="text-xs text-slate-500">Desk</span>`;
            document.getElementById("stat-device-bar").innerHTML = `
                <div class="bg-teal-400 h-full" style="width: ${mobilePct}%"></div>
                <div class="bg-indigo-500 h-full" style="width: ${desktopPct}%"></div>
            `;
            document.getElementById("analytics-status").textContent = `Syncing (${total} events recorded)`;
            const badge = document.getElementById("analytics-count-badge");
            if (badge) badge.textContent = `${total} views`;

            // Popular pages
            const sortedPages = Object.entries(pages).sort((a,b) => b[1] - a[1]).slice(0, 6);
            document.getElementById("popular-pages-list").innerHTML = sortedPages.length ? sortedPages.map(([path, cnt], idx) => {
                const pct = Math.round((cnt / total) * 100);
                return `
                    <div class="space-y-1">
                        <div class="flex justify-between text-xs">
                            <span class="font-semibold text-slate-200">#${idx + 1} ${path}</span>
                            <span class="font-mono text-white">${cnt} views (${pct}%)</span>
                        </div>
                        <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                            <div class="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full" style="width: ${Math.max(pct, 3)}%"></div>
                        </div>
                    </div>
                `;
            }).join("") : `<div class="text-slate-500">No visits logged yet.</div>`;

            // Referrers
            const sortedRefs = Object.entries(referrers).sort((a,b) => b[1] - a[1]).slice(0, 6);
            document.getElementById("top-referrers-list").innerHTML = sortedRefs.length ? sortedRefs.map(([source, cnt]) => {
                const pct = Math.round((cnt / total) * 100);
                return `
                    <div class="space-y-1">
                        <div class="flex justify-between text-xs">
                            <span class="font-semibold text-slate-200">${source}</span>
                            <span class="font-mono text-white">${cnt} hits (${pct}%)</span>
                        </div>
                        <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                            <div class="bg-gradient-to-r from-indigo-500 to-purple-400 h-full rounded-full" style="width: ${Math.max(pct, 3)}%"></div>
                        </div>
                    </div>
                `;
            }).join("") : `<div class="text-slate-500">No referrers logged yet.</div>`;

            // Stream
            document.getElementById("recent-stream-table").innerHTML = `
                <table class="w-full text-left">
                    <thead>
                        <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                            <th class="py-2.5 px-3">Path</th>
                            <th class="py-2.5 px-3">Source</th>
                            <th class="py-2.5 px-3">Device</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60">
                        ${events.slice(0, 12).map(ev => `
                            <tr class="hover:bg-slate-800/40">
                                <td class="py-2.5 px-3 font-mono text-teal-300">${ev.path || '/'}</td>
                                <td class="py-2.5 px-3 text-slate-300">${ev.referrer || 'Direct'}</td>
                                <td class="py-2.5 px-3">${ev.device === 'Mobile' ? '<span class="text-teal-400">Mobile</span>' : '<span class="text-indigo-400">Desktop</span>'}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        }, (err) => {
            document.getElementById("analytics-status").textContent = "Firestore connection error";
        });
    </script>
    <?php endif; ?>
</main>
</body>
</html>
