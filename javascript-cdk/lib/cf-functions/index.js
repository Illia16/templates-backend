// This file is used if CF function code is set "fromFile" (currently not used since can't pass env vars for basicAuth creds) 
function handler(event) {
    const expectedUsername = 'user';
    const expectedPassword = 'pw';
    console.log('___event', JSON.stringify(event));

    let request = event.request;
    const headers = request.headers;
    const isProd = headers.host.value === 'prod_domain_goes_here';

    console.log('______headers.host.value', JSON.stringify(headers.host.value));
    // Redirect if the request is from the CloudFront domain
    if (['d3e8kfpm2wxov0.cloudfront.net'].includes(headers.host.value)) {
        const customDomain = headers.host.value === "d3e8kfpm2wxov0.cloudfront.net" ? "test-project-javascript.illusha.net" : "test-project-javascript.illusha.net"

        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': { value: `https://${customDomain}${request.uri}` }
            }
        };
    }

    const objReject = {
        statusCode: 401,
        statusDescription: 'Unauthorized',
        headers: {
            'www-authenticate': { value: 'Basic' },
        },
    };

    if (!isProd) {
        if (!headers.authorization) {
            return objReject;
        }
    
        const authHeader = headers.authorization.value;
        const authString = authHeader.split(' ')[1];
        const authDecoded = Buffer.from(authString, 'base64').toString('utf-8');
        console.log('authHeader',  JSON.stringify(authHeader));
        console.log('authString',  JSON.stringify(authString));
        console.log('authDecoded',  JSON.stringify(authDecoded));
        const split = authDecoded.split(':');
    
        if (split[0] !== expectedUsername || split[1] !== expectedPassword) {
            return objReject;
        }
    }

    request.uri = request.uri.replace(/^(.*?)(\/?[^.\/]*\.[^.\/]*)?\/?$/, function($0, $1, $2) {
        return $1 + ($2 ? $2 : "/index.html");
    });

    return request;
}
