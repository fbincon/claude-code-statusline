/** Strip SDK response bodies, headers and signed URLs from diagnostics. */
export function safeError(e) {
    if(e?.code==='CI_NPM_CLI_MISSING')return 'Pinned npm CLI not found';
    if(['CI_NPM_INSTALL_TIMEOUT','CI_NPM_INSTALL_FAILED','CI_NPM_BAD_INTEGRITY'].includes(e?.code)){
        const detail=e.code==='CI_NPM_INSTALL_TIMEOUT'?'timed out':e.code==='CI_NPM_BAD_INTEGRITY'?'integrity mismatch':'failed';
        const version=/^\d+\.\d+\.\d+$/u.test(e.npmVersion)?e.npmVersion:'unknown';
        return 'Pinned npm install '+detail+' (npm '+version+', exit='+ (Number.isInteger(e.exitCode)?e.exitCode:'none')+', elapsed_ms='+(Number.isSafeInteger(e.elapsedMs)?e.elapsedMs:'unknown')+')';
    }
    const status=Number(e?.status??e?.statusCode??String(e?.message??'').match(/Failed request: \((\d{3})\)/u)?.[1]);
    if(Number.isInteger(status)&&status>=100&&status<=599)return 'HTTP '+status;
    const text=String(e?.message??'');
    const types=[[/ambigu/iu,'Ambiguous artifact identity'],[/digest|checksum|sha256|\bCRC\b/iu,'Artifact digest mismatch'],
        [/certificate|self.signed|cert_|tls_|ssl_/iu,'TLS certificate verification failed'],[/another.*(?:job|run)|belongs to|already owns/iu,'Artifact provenance mismatch'],
        [/size|limit|file size/iu,'Artifact size or time limit exceeded'],[/timeout|deadline/iu,'Transfer deadline exceeded'],
        [/SDK .*lock mismatch|tool dependency.*integrity/iu,'SDK lock or package integrity mismatch']];
    for(const [pattern,message] of types)if(pattern.test(text+' '+(e?.code??'')))return message;
    return /^[A-Z_0-9]{1,35}$/u.test(e?.code??'')?'Transfer failed ('+e.code+')':'Transfer verification failed';
}
