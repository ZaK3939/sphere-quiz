# SphereQuizGameNFT [![Open in Gitpod][gitpod-badge]][gitpod] [![Foundry][foundry-badge]][foundry] [![License: MIT][license-badge]][license]

[gitpod]: https://gitpod.io/#https://sphere-quiz.vercel.app/
[gitpod-badge]: https://img.shields.io/badge/Gitpod-Open%20in%20Gitpod-FFB45B?logo=gitpod
[foundry]: https://getfoundry.sh/
[foundry-badge]: https://img.shields.io/badge/Built%20with-Foundry-FFDB1C.svg
[license]: https://opensource.org/licenses/MIT
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg

## Test

```
forge test -vvv
```

## Deploy

### Scroll

```
forge script script/Deploy.s.sol:Deploy --rpc-url scroll --broadcast --verify --legacy --ffi
```

### ScrollSepolia

```
forge script script/DeploySepolia.s.sol:Deploy --rpc-url scroll-sepolia --broadcast --verify --legacy --ffi
```

### SepoliaEth

```
forge script script/Deploy.s.sol:Deploy --rpc-url sepolia --broadcast --verify --legacy --ffi
```

## License

This project is licensed under MIT.
