<?php
// ipn.php
// Listen for PayPal's IPN POST request

// Read POST data
$raw_post_data = file_get_contents('php://input');
$raw_post_array = explode('&', $raw_post_data);
$myPost = array();
foreach ($raw_post_array as $keyval) {
    $keyval = explode ('=', $keyval);
    if (count($keyval) == 2)
        $myPost[$keyval[0]] = urldecode($keyval[1]);
}

// Build the data to post back to PayPal for verification
$req = 'cmd=_notify-validate';
foreach ($myPost as $key => $value) {
    $value = urlencode($value);
    $req .= "&$key=$value";
}

// Verify IPN message with PayPal's validation URL
$paypal_url = 'https://ipnpb.paypal.com/cgi-bin/webscr';
$ch = curl_init($paypal_url);
if ($ch == FALSE) {
    error_log("Failed to initialize cURL for IPN");
    http_response_code(500);
    return;
}
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $req);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_FORBID_REUSE, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Connection: Close'));
$res = curl_exec($ch);
curl_close($ch);

// Inspect IPN validation result and act accordingly
if (strcmp($res, "VERIFIED") == 0) {
    // Check if payment is completed
    if (isset($_POST['payment_status']) && $_POST['payment_status'] == 'Completed') {
        // Extract variables
        $payer_email = $_POST['payer_email'] ?? '';
        $txn_id = $_POST['txn_id'] ?? '';
        $item_name = $_POST['item_name'] ?? '';
        $mc_gross = $_POST['mc_gross'] ?? '';
        $custom_id = $_POST['custom'] ?? ''; // This is the item ID
        
        // Generate professional HTML email
        $to = $payer_email;
        $subject = 'Your Invoice / Receipt from Keepin It Real';
        
        $message = '
        <html>
        <head>
          <title>Keepin It Real Invoice</title>
          <style>
            body { font-family: \'Helvetica Neue\', Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px; color: #374151; }
            .container { background-color: #ffffff; padding: 40px; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); }
            .header { text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 30px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #111827; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
            .header p { color: #6b7280; font-size: 16px; margin: 8px 0 0 0; }
            .details { margin-bottom: 40px; }
            .meta-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 15px; color: #4b5563; }
            .meta-info p { margin: 4px 0; }
            .details table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .details th, .details td { padding: 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            .details th { background-color: #f9fafb; color: #374151; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
            .details td { font-size: 16px; color: #111827; }
            .total { font-size: 20px; font-weight: 700; text-align: right; margin-top: 24px; color: #0d9488; }
            .footer { text-align: center; margin-top: 40px; font-size: 14px; color: #9ca3af; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 30px; }
            .footer a { color: #0d9488; text-decoration: none; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Keepin It Real</h1>
              <p>Invoice & Receipt</p>
            </div>
            <div class="details">
              <div class="meta-info">
                <div>
                  <p><strong>Date:</strong> ' . date('F j, Y') . '</p>
                </div>
                <div style="text-align: right;">
                  <p><strong>Transaction ID:</strong> ' . htmlspecialchars($txn_id) . '</p>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th style="text-align: right;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>' . htmlspecialchars($item_name) . '</td>
                    <td style="text-align: right;">$' . htmlspecialchars($mc_gross) . '</td>
                  </tr>
                </tbody>
              </table>
              <div class="total">
                Total Paid: $' . htmlspecialchars($mc_gross) . '
              </div>
            </div>
            <div class="footer">
              <p>Thank you for your purchase! We appreciate your support for the journey ahead.</p>
              <p>If you have any questions about this receipt, please contact us at <a href="mailto:support@keepinitreal.us">support@keepinitreal.us</a>.</p>
            </div>
          </div>
        </body>
        </html>
        ';

        // To send HTML mail, the Content-type header must be set
        $headers  = 'MIME-Version: 1.0' . "\r\n";
        $headers .= 'Content-type: text/html; charset=utf-8' . "\r\n";
        
        // Additional headers
        $headers .= 'From: Keepin It Real <noreply@keepinitreal.us>' . "\r\n";
        $headers .= 'Reply-To: support@keepinitreal.us' . "\r\n";
        $headers .= 'X-Mailer: PHP/' . phpversion();
        
        // Send the email
        if($to) {
            mail($to, $subject, $message, $headers);
        }
    }
} else if (strcmp($res, "INVALID") == 0) {
    // Log for manual investigation
    error_log("IPN Invalid: " . $req);
}

// Return 200 OK so PayPal stops sending IPN
http_response_code(200);
?>
