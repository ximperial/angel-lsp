import {expectSuccess} from "./utils";

describe('analyzer/warcraftHandleAssign', () => {
    expectSuccess([{
        uri: 'file:///path/to/as.predefined',
        content: `
            class handle { }
            class agent : handle { }
            class player : agent { }
            class rect : agent { }
            class fogmodifier : agent { }
            class war3image : agent { }
            class widget : war3image { }
            class unit : widget { }

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
        uri: 'file:///path/to/file.as',
        content: `
            rect playableRect;
            rect cameraRect;
            fogmodifier mapFogModifier;

            void main() {
                cameraRect = Rect(0.f, 0.f, 1.f, 1.f);
                playableRect = Rect(0.f, 0.f, 1.f, 1.f);
                GetRectCenterX(playableRect);
                GetRectCenterY(playableRect);
                mapFogModifier = CreateFogModifierRect(Player(0), 0, playableRect, false, false);
                AddFogModifierPlayer(mapFogModifier, Player(0));
                FogModifierStart(mapFogModifier);

                unit heroUnit = CreateUnit(Player(0), 1, 0.f, 0.f, 270.f);
                SelectUnit(heroUnit, true);
            }
        `
    }]);
});
