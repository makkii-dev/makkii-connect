#! /bin/bash
KEY_PATH=.

openssl genrsa 1024 > $KEY_PATH/private.pem
//
＃通过私钥文件生成CSR证书签名
openssl req -new -key $KEY_PATH/private.pem -out csr.pem
//
＃通过私钥文件和CSR证书签名生成证书文件
openssl x509 -req -days 365 -in csr.pem -signkey $KEY_PATH/private.pem -out $KEY_PATH/file.crt