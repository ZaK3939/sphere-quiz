export async function signMintData(to: string, score: number): Promise<`0x${string}`> {
  const response = await fetch('/api/signMint', {
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
    return `0x`;
  }
}
