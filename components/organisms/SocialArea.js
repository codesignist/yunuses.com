import Social from "../molecules/Social";

const SocialArea = ({
  data: { next_sosyal, youtube, github, linkedin, twitter, instagram },
}) => (
  <div className="flex flex-wrap gap-1 -ml-2">
    {next_sosyal && <Social icon="next_sosyal" href={next_sosyal} />}
    {youtube && <Social icon="youtube" href={youtube} />}
    {github && <Social icon="github" href={github} />}
    {linkedin && <Social icon="linkedin" href={linkedin} />}
    {twitter && <Social icon="twitter" href={twitter} />}
    {instagram && <Social icon="instagram" href={instagram} />}
  </div>
);

export default SocialArea;
