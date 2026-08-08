<?php
session_start();

$password = 'admin123'; // Change this to a secure password
$videosFile = 'videos.json';
$merchFile = 'merch.json';
$merchUploadDir = 'uploads/merch/';

// Handle login
if (isset($_POST['login'])) {
    if ($_POST['password'] === $password) {
        $_SESSION['logged_in'] = true;
    } else {
        $error = "Incorrect password.";
    }
}

// Handle logout
if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: admin.php");
    exit;
}

if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    // Show login form
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Admin Login</title>
        <style>
            body { font-family: 'Inter', sans-serif; background-color: #F8FAFC; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .login-box { background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); text-align: center; }
            input[type="password"] { padding: 12px; width: 100%; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; }
            button { background: #0F172A; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; width: 100%; font-weight: bold; }
            .error { color: #ef4444; margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="login-box">
            <h2>Admin Login</h2>
            <?php if (isset($error)) echo "<p class='error'>$error</p>"; ?>
            <form method="POST">
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit" name="login">Login</button>
            </form>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// Active Tab Handling
$activeTab = isset($_GET['tab']) ? $_GET['tab'] : 'videos';

// Ensure files exist
if (!file_exists($videosFile)) file_put_contents($videosFile, '[]');
if (!file_exists($merchFile)) file_put_contents($merchFile, '[]');

$videos = json_decode(file_get_contents($videosFile), true) ?: [];
$merch = json_decode(file_get_contents($merchFile), true) ?: [];

// ========================
// HANDLE VIDEOS CRUD
// ========================
if (isset($_POST['add_video'])) {
        $url = trim($_POST['url']);
        if (!empty($url)) {
            $title = 'New Video';
            
            // Normalize URL to a format YouTube oEmbed accepts (watch?v=)
            $oembed_target_url = $url;
            if (preg_match('/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i', $url, $matches)) {
                $oembed_target_url = 'https://www.youtube.com/watch?v=' . $matches[1];
            } else if (preg_match('/youtu\.be\/([a-zA-Z0-9_-]+)/i', $url, $matches)) {
                $oembed_target_url = 'https://www.youtube.com/watch?v=' . $matches[1];
            }
            
            $oembed_url = 'https://www.youtube.com/oembed?url=' . urlencode($oembed_target_url) . '&format=json';
            
            // Use User-Agent and increase timeout to prevent rejection
            $options = [
                'http' => [
                    'method' => 'GET',
                    'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n",
                    'timeout' => 5
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
            
            array_unshift($videos, ['id' => uniqid(), 'url' => $url, 'title' => $title]);
        file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
        header("Location: admin.php?tab=videos");
        exit;
    }
}

if (isset($_POST['delete_video'])) {
    $id = $_POST['id'];
    $videos = array_values(array_filter($videos, function($v) use ($id) { return $v['id'] !== $id; }));
    file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));
    header("Location: admin.php?tab=videos");
    exit;
}

if (isset($_POST['move_up']) || isset($_POST['move_down'])) {
    $id = $_POST['id'];
    $index = array_search($id, array_column($videos, 'id'));
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
    header("Location: admin.php?tab=videos");
    exit;
}

// ========================
// HANDLE MERCH CRUD
// ========================
if (isset($_POST['add_merch'])) {
    $name = trim($_POST['name']);
    $price = trim($_POST['price']);
    $hasSizes = isset($_POST['hasSizes']) ? true : false;
    
    if (isset($_FILES['image']) && $_FILES['image']['error'] == 0) {
        if (!is_dir($merchUploadDir)) {
            mkdir($merchUploadDir, 0777, true);
        }
        $fileName = time() . '_' . basename($_FILES['image']['name']);
        $targetPath = $merchUploadDir . $fileName;
        
        if (move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
            // 1 & 2. Read and decode existing merch items (default to empty array)
            $existingMerch = [];
            if (file_exists($merchFile)) {
                $content = file_get_contents($merchFile);
                if (!empty($content)) {
                    $decoded = json_decode($content, true);
                    if (is_array($decoded)) {
                        $existingMerch = $decoded;
                    }
                }
            }
            
            // 3. Add the new item to the beginning of the array
            array_unshift($existingMerch, [
                'id' => uniqid(),
                'name' => $name,
                'price' => $price,
                'imageUrl' => '/' . $targetPath,
                'hasSizes' => $hasSizes,
                'createdAt' => time()
            ]);
            
            // 4. Encode and save back to merch.json
            file_put_contents($merchFile, json_encode($existingMerch, JSON_PRETTY_PRINT));
        }
    }
    header("Location: admin.php?tab=merch");
    exit;
}

if (isset($_POST['delete_merch'])) {
    $id = $_POST['id'];
    $itemToDelete = null;
    foreach ($merch as $item) {
        if ($item['id'] === $id) { $itemToDelete = $item; break; }
    }
    if ($itemToDelete) {
        $filePath = ltrim($itemToDelete['imageUrl'], '/');
        if (file_exists($filePath)) unlink($filePath);
        $merch = array_values(array_filter($merch, function($m) use ($id) { return $m['id'] !== $id; }));
        file_put_contents($merchFile, json_encode($merch, JSON_PRETTY_PRINT));
    }
    header("Location: admin.php?tab=merch");
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Keepin' It Real - Admin</title>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 40px 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .tabs { display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid #E2E8F0; }
        .tab { padding: 12px 20px; text-decoration: none; color: #64748B; font-weight: bold; border-bottom: 3px solid transparent; margin-bottom: -2px; }
        .tab.active { color: #0F172A; border-bottom-color: #0F172A; }
        .tab:hover { color: #0F172A; }
        
        .card { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); margin-bottom: 40px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px; }
        input[type="text"], input[type="file"] { padding: 12px; width: 100%; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; }
        button { background: #0D9488; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .btn-danger { background: #ef4444; padding: 8px 15px; font-size: 14px; }
        .btn-secondary { background: #64748b; padding: 8px 12px; font-weight: normal; }
        .item-list { margin-top: 20px; }
        .list-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #F1F5F9; }
        .list-item:last-child { border-bottom: none; }
        
        .merch-preview { display: flex; align-items: center; gap: 15px; }
        .merch-preview img { width: 50px; height: 50px; object-fit: cover; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Admin Dashboard</h1>
            <a href="admin.php?logout=1" style="color: #ef4444; text-decoration: none; font-weight: bold;">Logout</a>
        </div>
        
        <div class="tabs">
            <a href="?tab=videos" class="tab <?= $activeTab === 'videos' ? 'active' : '' ?>">Manage YouTube Videos</a>
            <a href="?tab=merch" class="tab <?= $activeTab === 'merch' ? 'active' : '' ?>">Manage Merch Items</a>
        </div>
        
        <?php if ($activeTab === 'videos'): ?>
        <!-- VIDEOS SECTION -->
        <div class="card">
            <h3>Add New Video</h3>
            <form method="POST" style="margin-top: 20px;">
                <div class="form-group">
                    <input type="text" name="url" placeholder="YouTube Embed URL (e.g. https://www.youtube.com/embed/...)" required>
                </div>
                <button type="submit" name="add_video">Add Video</button>
            </form>
        </div>

        <div class="card">
            <h3>Manage Videos (<?= count($videos) ?>)</h3>
            <div class="item-list">
                <?php foreach ($videos as $video): ?>
                <div class="list-item">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;">
                        <?= htmlspecialchars($video['url']) ?>
                    </span>
                    <form method="POST" style="margin: 0; display: flex; gap: 5px;">
                        <input type="hidden" name="id" value="<?= $video['id'] ?>">
                        <button type="submit" name="move_up" class="btn-secondary">↑</button>
                        <button type="submit" name="move_down" class="btn-secondary">↓</button>
                        <button type="submit" name="delete_video" class="btn-danger">Delete</button>
                    </form>
                </div>
                <?php endforeach; ?>
                <?php if(empty($videos)) echo "<p>No videos found.</p>"; ?>
            </div>
        </div>
        <?php endif; ?>

        <?php if ($activeTab === 'merch'): ?>
        <!-- MERCH SECTION -->
        <div class="card">
            <h3>Add New Merch Item</h3>
            <form method="POST" enctype="multipart/form-data" style="margin-top: 20px;">
                <div class="form-group">
                    <label>Item Name</label>
                    <input type="text" name="name" placeholder="e.g. Signature T-Shirt" required>
                </div>
                <div class="form-group">
                    <label>Price</label>
                    <input type="text" name="price" placeholder="e.g. $25.00" required>
                </div>
                <div class="form-group">
                    <label>Product Image</label>
                    <input type="file" name="image" accept="image/*" required>
                </div>
                <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" name="hasSizes" id="hasSizes" value="1" style="width: auto;">
                    <label for="hasSizes" style="margin: 0;">Requires Size Selection (S, M, L, XL, XXL)</label>
                </div>
                <button type="submit" name="add_merch">Add Item</button>
            </form>
        </div>

        <div class="card">
            <h3>Current Merch Items (<?= count($merch) ?>)</h3>
            <div class="item-list">
                <?php foreach ($merch as $item): ?>
                <div class="list-item">
                    <div class="merch-preview">
                        <img src="<?= htmlspecialchars($item['imageUrl']) ?>" alt="preview">
                        <div>
                            <strong><?= htmlspecialchars($item['name']) ?></strong><br>
                            <span style="color: #0D9488;"><?= htmlspecialchars($item['price']) ?></span>
                        </div>
                    </div>
                    <form method="POST" style="margin: 0;">
                        <input type="hidden" name="id" value="<?= $item['id'] ?>">
                        <button type="submit" name="delete_merch" class="btn-danger">Delete</button>
                    </form>
                </div>
                <?php endforeach; ?>
                <?php if(empty($merch)) echo "<p>No merch items found.</p>"; ?>
            </div>
        </div>
        <?php endif; ?>
    </div>
</body>
</html>
