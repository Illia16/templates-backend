# templates-backend

## javascript
- cd javascript-cdk
- npm i
- npm run deploy:javascript
- create .env.javascript under /javascript-cdk with the following env vars
    - ENV_NAME=[test|prod]
    - PROJECT_NAME=[sample_project_name]
    - CLOUDFRONT_URL=[your_domain.com] -- primarily for handling CORS
    - CLOUDFRONT_USERNAME=[basic_auth_login] -- to set in CF function
    - CLOUDFRONT_PASSWORD=[basic_auth_pw] -- to set in CF function
    - CERTIFICATE_ARN=[arn_of_ssl_cert] -- to be manually uploaded into AWS ACM

## python
- cd python-cdk
- python -m pip install -r requirements.txt
- .venv\Scripts\activate.bat (Windows) (source .venv/bin/activate (Mac))
- cdk deploy