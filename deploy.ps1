$env:NETLIFY_AUTH_TOKEN="nfp_BxvR8jjW3hKi9A8fiPf2EWmXqij7MHzV3745"

Write-Host "Setting GS_URL_FORM1..."
npx netlify-cli env:set GS_URL_FORM1 "https://script.google.com/macros/s/AKfycbwMgAn4rZ2UKXkpfm0H_WqI6j0HFL-zVBmnm0ZxZ2UQQQaiu2igWK8UnUgTX3VJTY0/exec"

Write-Host "Setting GS_URL_FORM2..."
npx netlify-cli env:set GS_URL_FORM2 "https://script.google.com/macros/s/AKfycbwhJR-n2cMtkgLrXlUsjuWYdRry-z7Zxlz8OYs08TvsL2zQe-GbimSfQBZMEhaKVT1EvQ/exec"

Write-Host "Setting GS_URL_FORM3..."
npx netlify-cli env:set GS_URL_FORM3 "https://script.google.com/macros/s/AKfycbzOyx6qCWafg1EaS7k2G7FX00IA1ozKTKfbD28nXeqvbiTNpTWikZ4PGffFaYXi7_Jc/exec"

Write-Host "Deploying to production..."
npx netlify-cli deploy --prod
