export async function signMintData(to: string, score: number): Promise<`0x${string}`> {
  const PUBLIC_VERCEL_URL = process.env.PUBLIC_VERCEL_URL;
  let baseUrl = !IS_DEV_MODE ? '' : PUBLIC_VERCEL_URL;

  const response = await fetch(`${baseUrl}/api/signMint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, score }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Signature:', data.signature);
    return data.signature;
  } else {
    console.error('Error signing mint data');
    // throw an error
    throw new Error('Error signing mint data');
  }
}
