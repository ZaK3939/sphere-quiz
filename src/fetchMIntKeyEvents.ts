interface MintKeyEvent {
  keyId: string;
  player: string;
  score: string;
  to: string;
  tokenId: string;
}

interface Response {
  data: {
    mintKeyEvents: MintKeyEvent[];
  };
}

async function fetchMintKeyEvents(address: string): Promise<MintKeyEvent[]> {
  const query = `
      query ($address: String!) {
        mintKeyEvents(where: { player: $address }) {
          keyId
          player
          score
          to
          tokenId
        }
      }
    `;

  const variables = {
    address: address.toLowerCase(),
  };

  try {
    const response = await fetch('https://api.studio.thegraph.com/query/29168/spherequizgamenft/v0.0.1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: Response = await response.json();
    return data.data.mintKeyEvents;
  } catch (error) {
    console.error('Error fetching mint key events:', error);
    throw error;
  }
}
