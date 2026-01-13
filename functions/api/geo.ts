
export const onRequest: PagesFunction = async (context) => {
    const country = context.request.headers.get('cf-ipcountry') || 'US';

    return new Response(JSON.stringify({ country }), {
        headers: {
            'content-type': 'application/json;charset=UTF-8',
        },
    });
};
