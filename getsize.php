<?php
    // This script can can provide LLAMA with custom-sized
    // resources.  This approach has the drawback to require a
    // third-party web server that runs this script. Note that
    // we have not used this approach in our evaluation, but since we
    // describe it in the paper we publish it for completeness.

    // TODO: semantic checks to prevent DOS attacks here

    // Initialize string
    $str = "";

    // Using GET will make the URL observable (only) at the link from exit
    // node to web server. This is fine given that the we assume the
    // attacker is at the link between client and guard. Also, it will
    // allow Tor exit nodes to track the use of the extension (but also
    // block it). 

    // Parse the GET parameter
    $sz = 0;
    if (isset($_GET["size"])) {
        $sz = $_GET["size"];
    }

    // TODO: We probably want to include some kind of validation so that
    // people cannot inject code or request a very large request that will
    // load the server. Some basic validation:

    // 10MB maximum request
    if ($sz >= 10000000) { 
        return;
    }

    // check the parameter value is an integer
    if (!(is_numeric($sz))) {
        return;
    }

    // Generate a string as long as indicated in the GET parameter this
    // will generate a plain text of the same number of bytes as
    // characters in this string. The attacker shouldn't be able to see
    // the string nor the type of resource because they are encrypted.
    
    // We generate a pseudo-random string to minimize the effect of
    // possible  HTTP compression, as it would not match the target size.
    $str .= random_bytes($sz);

    // Echo the string. There is no other HTML content. The browser should
    // be okay with receiving a non HTML document and this allows us to
    // give the resource the exact size specified in the HTTP GET query.
    echo $str; 
?> 
