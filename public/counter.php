<?php
$file = 'counter.txt';

if (!file_exists($file)) {
    $count = 19543;
} else {
    $count = (int)file_get_contents($file);
    $count++;
}

file_put_contents($file, $count);

header('Content-Type: application/json');
echo json_encode(['count' => $count]);
?>
