import {expectSuccess} from "./utils";

describe('analyzer/mapRuntimeRegression', () => {
    expectSuccess([{
        uri: 'file:///path/to/as.predefined',
        content: `
            #include "my.as.predefined"

            class handle { }
            class agent : handle { }
            class player : agent { }
            class rect : agent { }
            class fogmodifier : agent { }
            class war3image : agent { }
            class widget : war3image { }
            class unit : widget { }

            class array<T> {
                T& opIndex(uint index);
                const T& opIndex(uint index) const;
                uint length() const;
            }

            rect Rect(float, float, float, float);
            float GetRectCenterX(rect whichRect);
            float GetRectCenterY(rect whichRect);
            fogmodifier CreateFogModifierRect(player whichPlayer, int fogState, rect where, bool sharedVision, bool afterUnits);
            void AddFogModifierPlayer(fogmodifier whichFogModifier, player whichPlayer);
            void FogModifierStart(fogmodifier whichFogModifier);
            unit CreateUnit(player id, int unitid, float x, float y, float face);
            void SelectUnit(unit whichUnit, bool flag);
            player Player(int id);
        `
    }, {
        uri: 'file:///path/to/my.as.predefined',
        content: `
            rect cameraRect;
            rect playableRect;
            fogmodifier mapFogModifier;
            array<bool> isPlayerPlayingList;
        `
    }, {
        uri: 'file:///path/to/file.as',
        content: `
            #include "as.predefined"

            float GetPlayableCenterX() {
                return GetRectCenterX(playableRect);
            }

            float GetPlayableCenterY() {
                return GetRectCenterY(playableRect);
            }

            void InitializeCameraBounds() {
                cameraRect = Rect(0.f, 0.f, 1.f, 1.f);
                playableRect = Rect(0.f, 0.f, 1.f, 1.f);
            }

            void InitializeFogVision() {
                mapFogModifier = CreateFogModifierRect(Player(0), 0, playableRect, false, false);
                AddFogModifierPlayer(mapFogModifier, Player(0));
                FogModifierStart(mapFogModifier);
            }

            void SpawnPlayerHero(player playerRef) {
                unit heroUnit = CreateUnit(playerRef, 1, GetPlayableCenterX(), GetPlayableCenterY(), 270.f);
                SelectUnit(heroUnit, true);
            }

            void InitializeHumanPlayers() {
                for (uint i = 0; i < isPlayerPlayingList.length(); i++) {
                    player playerRef = Player(i);
                    isPlayerPlayingList[i] = true;
                    SpawnPlayerHero(playerRef);
                }
            }
        `
    }]);
});
