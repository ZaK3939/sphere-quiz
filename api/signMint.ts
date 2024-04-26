import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { scroll, scrollSepolia } from 'viem/chains';

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY ?? '0x00';
const account = privateKeyToAccount(SIGNER_PRIVATE_KEY as Hex);

const SPHERE_QUIZ_NFT_ADDRESS = '0x82845DfA6D2185547480372EeDf213d4C2976da3';

const domain = {
  name: 'SPHERE-QUIZ NFT MINT',
  version: '1',
  chainId: scrollSepolia.id,
  verifyingContract: SPHERE_QUIZ_NFT_ADDRESS,
} as const;

const types = {
  Mint: [
    { name: 'to', type: 'address' },
    { name: 'score', type: 'uint256' },
  ],
};

async function signMintData(mintData) {
  return account.signTypedData({
    domain,
    types,
    primaryType: 'Mint',
    message: {
      to: mintData.to,
      score: BigInt(mintData.score),
    },
  });
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { to, score } = req.body;

    try {
      const signature = await signMintData({ to, score });

      // For debugging purposes
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      res.status(200).json({ signature });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'An error occurred' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
