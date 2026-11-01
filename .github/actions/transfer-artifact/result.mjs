/** Strip SDK response bodies, headers and signed URLs from diagnostics. */
export function safeError(e) {
    const status=Number(e?.status??e?.statusCode??String(e?.message??'').match(/Failed request: \((\d{3})\)/u)?.[1]);
    if(Number.isInteger(status)&&status>=100&&status<=599)return 'HTTP '+status;
    const text=String(e?.message??'');
    const types=[[/ambigu/iu,'Ambiguous artifact identity'],[/digest|checksum|sha256|\bCRC\b/iu,'Artifact digest mismatch'],
        [/certificate|self.signed|cert_|tls_|ssl_/iu,'TLS certificate verification failed'],[/another.*(?:job|run)|belongs to|already owns/iu,'Artifact provenance mismatch'],
        [/size|limit|file size/iu,'Artifact size or time limit exceeded'],[/timeout|deadline/iu,'Transfer deadline exceeded'],
        [/ npm |npm CLI|npm-cli|tool dependency/iu,'Pinned npm toolchain unavailable']];
    for(const [pattern,message] of types)if(pattern.test(text+' '+(e?.code??'')))return message;
    return /^[A-Z_0-9]{1,35}$/u.test(e?.code??'')?'Transfer failed ('+e.code+')':'Transfer verification failed';
}
